// api/admin-live.js — Returns live visitor stats for the admin dashboard

import { kv } from '@vercel/kv';

const ADMIN_USER = 'fintankeenan';
const ADMIN_PASS = 'Laragh';

function checkAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    const [u, p] = decoded.split(':');
    return u === ADMIN_USER && p === ADMIN_PASS;
  } catch { return false; }
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
