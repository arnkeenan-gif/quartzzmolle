// api/locker-login.js — Code gate for the locker control panel.
// Checks the access code on the SERVER (so it can't be bypassed by reading the page),
// locks out brute-force attempts, and issues a signed, http-only session cookie.

import { kv } from '@vercel/kv';
import { createHmac } from 'crypto';

const CODE = process.env.LOCKER_CODE || '2907';                      // change in Vercel env if you like
const SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';
const SESSION_HOURS = 8;
const MAX_FAILS = 5;            // wrong tries allowed...
const LOCK_SECONDS = 900;      // ...before a 15-minute lockout per IP

function sign(expMs) {
  const data = String(expMs);
  const mac = createHmac('sha256', SECRET).update(data).digest('hex');
  return data + '.' + mac;
}

function cookie(value, maxAge) {
  return `lk_sess=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Logout
  if (req.body && req.body.action === 'logout') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(200).json({ ok: true });
  }

  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown').trim();
  const failKey = `locker:fails:${ip}`;

  let fails = 0;
  try { fails = (await kv.get(failKey)) || 0; } catch {}
  if (fails >= MAX_FAILS) {
    return res.status(429).json({ error: 'For mange forsøg. Prøv igen om lidt.' });
  }

  const code = (req.body?.code ?? '').toString();
  if (code !== CODE) {
    try { await kv.set(failKey, fails + 1, { ex: LOCK_SECONDS }); } catch {}
    return res.status(401).json({ error: 'Forkert kode', triesLeft: Math.max(0, MAX_FAILS - fails - 1) });
  }

  try { await kv.del(failKey); } catch {}
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  res.setHeader('Set-Cookie', cookie(sign(exp), SESSION_HOURS * 3600));
  return res.status(200).json({ ok: true });
}
