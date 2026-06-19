// api/locker-state.js — Returns the full locker state for the panel (auth required).

import { kv } from '@vercel/kv';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';
const DOORS = 22;
const STALE_MS = 20000; // tablet counts as "online" if it synced within 20 s

function verify(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)lk_sess=([^;]+)/);
  if (!m) return false;
  const tok = decodeURIComponent(m[1]);
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return false;
  const data = tok.slice(0, dot), mac = tok.slice(dot + 1);
  const expect = createHmac('sha256', SECRET).update(data).digest('hex');
  try {
    if (mac.length !== expect.length) return false;
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expect, 'hex'))) return false;
  } catch { return false; }
  const exp = parseInt(data, 10);
  return Number.isFinite(exp) && exp > Date.now();
}

function defaultLockers() {
  const a = [];
  for (let i = 1; i <= DOORS; i++) a.push({ door: i, occ: false, code: null, since: 0, oos: false });
  return a;
}

export default async function handler(req, res) {
  if (!verify(req)) return res.status(401).json({ error: 'Unauthorized' });

  let lockers = defaultLockers();
  let history = [];
  let device = { lastSeen: 0 };
  try {
    const s = await kv.get('locker:state');
    if (s && s.lockers) lockers = s.lockers;
    history = (await kv.lrange('locker:history', 0, 99)) || [];
    device = (await kv.get('locker:device')) || { lastSeen: 0 };
  } catch {}

  const online = !!(device.lastSeen && Date.now() - device.lastSeen < STALE_MS);
  return res.status(200).json({
    lockers,
    history,
    device: { lastSeen: device.lastSeen || 0, online },
    now: Date.now(),
  });
}
