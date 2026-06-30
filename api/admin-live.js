// api/admin-live.js — Returns live visitor stats for the admin dashboard

import { kv } from '@vercel/kv';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';

// Verify the HMAC-signed lk_sess cookie set by /api/locker (action=login) —
// the same login used by /locker and /fulfill.
function checkAuth(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)lk_sess=([^;]+)/);
  if (!m) return false;
  const tok = decodeURIComponent(m[1]);
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return false;
  const data = tok.slice(0, dot), mac = tok.slice(dot + 1);
  const expect = createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  try {
    if (mac.length !== expect.length) return false;
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expect, 'hex'))) return false;
  } catch { return false; }
  const exp = parseInt(data, 10);
  return Number.isFinite(exp) && exp > Date.now();
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 60; // 60 seconds = "active now"

    // Clean expired visitors then count
    await kv.zremrangebyscore('active_visitors', 0, cutoff);
    const activeNow = await kv.zcard('active_visitors') || 0;

    // Today's unique visitors
    const today = new Date().toISOString().slice(0, 10);
    const visitorsToday = await kv.scard(`visitors:${today}`) || 0;

    // Yesterday's
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const visitorsYesterday = await kv.scard(`visitors:${yesterday}`) || 0;

    return res.status(200).json({
      activeNow,
      visitorsToday,
      visitorsYesterday,
    });
  } catch (err) {
    // KV not configured - return zeros gracefully
    return res.status(200).json({
      activeNow: 0,
      visitorsToday: 0,
      visitorsYesterday: 0,
      _note: 'Vercel KV not configured',
    });
  }
}
