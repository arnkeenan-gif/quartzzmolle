// api/log-visit.js — Logs a visitor heartbeat to Vercel KV
//
// Called by every page on the site every 30 seconds.
// Stores: visitor IDs with timestamps for "active now" + daily counters.

import { kv } from './_kv.js';

// Only allow the site's own origins to post visitor heartbeats (reduces
// off-site abuse / metric pollution). '*' previously let anyone write.
const ALLOWED_ORIGINS = [
  'https://quartzmolle.dk',
  'https://www.quartzmolle.dk',
  'https://quartzzmolle-dusky.vercel.app',
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  // Reject cross-origin callers (requests with an Origin that isn't ours).
  // Same-origin fetches from our own pages typically omit Origin or send ours.
  if (origin && !allowed) return res.status(403).json({ ok: false });

  try {
    // Simple visitor ID = hash of trusted IP + user-agent (no cookies needed)
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
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
