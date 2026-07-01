// api/log-visit.js — Logs a visitor heartbeat to Vercel KV
//
// Called by every page on the site every 30 seconds.
// Stores: visitor IDs with timestamps for "active now" + daily counters.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Allow CORS for our own domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Simple visitor ID = hash of IP + user-agent (no cookies needed)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
    const ua = (req.headers['user-agent'] || '').slice(0, 100);
    const visitorId = Buffer.from(ip + '|' + ua).toString('base64').slice(0, 24);

    const now = Math.floor(Date.now() / 1000);

    // Active visitors: sorted set, score = timestamp
    // Members older than 60 sec are removed when we query
    await kv.zadd('active_visitors', { score: now, member: visitorId });

    // Daily unique visitor counter using a date-stamped set
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await kv.sadd(`visitors:${today}`, visitorId);
    // Keep daily sets ~100 days so the admin can show accurate conversion rates
    // for 7/30/90-day periods (not just the last week).
    await kv.expire(`visitors:${today}`, 100 * 86400);

    return res.status(200).json({ ok: true });
  } catch (err) {
    // KV may not be configured yet - fail silently so site keeps working
    console.error('log-visit error:', err.message);
    return res.status(200).json({ ok: false });
  }
}
