// api/locker-command.js — Panel actions: open a door, new deposit, clear, out-of-service.
// Logical state lives here in KV; physical "open" pulses are queued for the tablet to execute.

import { kv } from '@vercel/kv';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

const SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';
const DOORS = 22;

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

async function getLockers() {
  try { const s = await kv.get('locker:state'); if (s && s.lockers) return s.lockers; } catch {}
  return defaultLockers();
}
async function saveLockers(lockers) {
  await kv.set('locker:state', { lockers, updated: Date.now() });
}
async function log(ev) {
  await kv.lpush('locker:history', { t: Date.now(), source: 'web', ...ev });
  await kv.ltrim('locker:history', 0, 499);
}
async function queueOpen(door) {
  await kv.rpush('locker:cmds', { id: randomUUID(), type: 'open', door, t: Date.now() });
}
function genCode(lockers) {
  const used = new Set(lockers.filter(l => l.occ && l.code).map(l => l.code));
  let c;
  do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (used.has(c));
  return c;
}

export default async function handler(req, res) {
  if (!verify(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body || {};
  const door = parseInt(req.body?.door, 10);

  try {
    const lockers = await getLockers();

    if (action === 'open') {
      if (!(door >= 1 && door <= DOORS)) return res.status(400).json({ error: 'Ugyldig dør' });
      await queueOpen(door);
      await log({ type: 'open', locker: door, code: '' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'deposit') {
      let d = door;
      if (!(d >= 1 && d <= DOORS)) {
        const free = lockers.find(l => !l.occ && !l.oos);
        if (!free) return res.status(409).json({ error: 'Alle skabe er optaget' });
        d = free.door;
      }
      const t = lockers.find(l => l.door === d);
      if (!t || t.occ || t.oos) return res.status(409).json({ error: 'Skabet er ikke ledigt' });
      const code = genCode(lockers);
      t.occ = true; t.code = code; t.since = Date.now();
      await saveLockers(lockers);
      await queueOpen(d);
      await log({ type: 'in', locker: d, code });
      return res.status(200).json({ ok: true, door: d, code });
    }

    if (action === 'clear') {
      const t = lockers.find(l => l.door === door);
      if (!t) return res.status(400).json({ error: 'Ugyldig dør' });
      const old = t.code;
      t.occ = false; t.code = null; t.since = 0;
      await saveLockers(lockers);
      await log({ type: 'out', locker: door, code: old || '' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'oos') {
      const t = lockers.find(l => l.door === door);
      if (!t) return res.status(400).json({ error: 'Ugyldig dør' });
      t.oos = !t.oos;
      await saveLockers(lockers);
      await log({ type: t.oos ? 'oos_on' : 'oos_off', locker: door, code: '' });
      return res.status(200).json({ ok: true, oos: t.oos });
    }

    return res.status(400).json({ error: 'Ukendt handling' });
  } catch (e) {
    return res.status(500).json({ error: 'Serverfejl: ' + e.message });
  }
}
