// api/locker-state.js — GET: returns state for panel. POST: panel commands (open/deposit/clear/oos).
import { kv } from '@vercel/kv';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';
const DOORS = 22;
const STALE_MS = 60000;

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

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

export default async function handler(req, res) {
      if (!verify(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — return full state for the panel
  if (req.method === 'GET') {
          let lockers = defaultLockers(), history = [], device = { lastSeen: 0 };
          try {
                    const s = await kv.get('locker:state');
                    if (s && s.lockers) lockers = s.lockers;
                    history = (await kv.lrange('locker:history', 0, 199)) || [];
                    device = (await kv.get('locker:device')) || { lastSeen: 0 };
          } catch {}
          const online = !!(device.lastSeen && Date.now() - device.lastSeen < STALE_MS);
          return res.status(200).json({ lockers, history, device: { lastSeen: device.lastSeen || 0, online }, now: Date.now() });
  }

  // POST — panel commands
  if (req.method !== 'POST') return res.status(405).end();
      const { action, door } = req.body || {};

  try {
          const s = await kv.get('locker:state');
          const lockers = (s && s.lockers) ? s.lockers : defaultLockers();

        if (action === 'open') {
                  if (!door) return res.status(400).json({ error: 'Missing door' });
                  await kv.rpush('locker:cmds', { action: 'open', door: Number(door) });
                  await kv.lpush('locker:history', { t: Date.now(), type: 'open', locker: Number(door), code: '', source: 'web' });
                  await kv.ltrim('locker:history', 0, 499);
                  return res.status(200).json({ ok: true });
        }

        if (action === 'deposit') {
                  const free = lockers.find(l => !l.occ && !l.oos);
                  if (!free) return res.status(409).json({ error: 'Ingen ledige skabe' });
                  const code = genCode();
                  free.occ = true; free.code = code; free.since = Date.now();
                  await kv.set('locker:state', { lockers, updated: Date.now() });
                  await kv.rpush('locker:cmds', { action: 'open', door: free.door });
                  await kv.lpush('locker:history', { t: Date.now(), type: 'in', locker: free.door, code, source: 'web' });
                  await kv.ltrim('locker:history', 0, 499);
                  return res.status(200).json({ ok: true, door: free.door, code });
        }

        if (action === 'clear') {
                  if (!door) return res.status(400).json({ error: 'Missing door' });
                  const lk = lockers.find(l => l.door === Number(door));
                  if (lk) { lk.occ = false; lk.code = null; lk.since = 0; }
                  await kv.set('locker:state', { lockers, updated: Date.now() });
                  await kv.lpush('locker:history', { t: Date.now(), type: 'out', locker: Number(door), code: '', source: 'web' });
                  await kv.ltrim('locker:history', 0, 499);
                  return res.status(200).json({ ok: true });
        }

        if (action === 'oos') {
                  if (!door) return res.status(400).json({ error: 'Missing door' });
                  const lk = lockers.find(l => l.door === Number(door));
                  if (lk) { lk.oos = !lk.oos; }
                  await kv.set('locker:state', { lockers, updated: Date.now() });
                  const oosType = lk && lk.oos ? 'oos_on' : 'oos_off';
                  await kv.lpush('locker:history', { t: Date.now(), type: oosType, locker: Number(door), code: '', source: 'web' });
                  await kv.ltrim('locker:history', 0, 499);
                  return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
          return res.status(500).json({ error: e.message });
  }
}
