// api/locker-device.js — The tablet syncs here every few seconds.
// Auth is a separate device secret (NOT the human access code).
// The tablet sends any local kiosk events, and receives back the queued
// "open door" commands to fire plus the authoritative locker state to mirror.

import { kv } from '@vercel/kv';

const DEVICE_SECRET = process.env.LOCKER_DEVICE_SECRET || '';
const DOORS = 22;

function defaultLockers() {
  const a = [];
  for (let i = 1; i <= DOORS; i++) a.push({ door: i, occ: false, code: null, since: 0, oos: false });
  return a;
}

export default async function handler(req, res) {
  if (!DEVICE_SECRET || (req.headers['x-device-secret'] || '') !== DEVICE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await kv.set('locker:device', { lastSeen: Date.now() });

    // 1) Apply events that happened locally at the kiosk since last sync.
    const events = (req.body && Array.isArray(req.body.events)) ? req.body.events : [];
    if (events.length) {
      const s = await kv.get('locker:state');
      const lockers = (s && s.lockers) ? s.lockers : defaultLockers();
      for (const ev of events) {
        const t = lockers.find(l => l.door === ev.locker);
        if (!t) continue;
        if (ev.type === 'in') { t.occ = true; t.code = ev.code; t.since = ev.t || Date.now(); }
        else if (ev.type === 'out') { t.occ = false; t.code = null; t.since = 0; }
        else if (ev.type === 'oos') { t.oos = !!ev.value; }
        await kv.lpush('locker:history', {
          t: ev.t || Date.now(), type: ev.type, locker: ev.locker, code: ev.code || '', source: 'kiosk',
        });
      }
      await kv.ltrim('locker:history', 0, 499);
      await kv.set('locker:state', { lockers, updated: Date.now() });
    }

    // 2) Drain queued open commands for the tablet to actuate.
    const opens = [];
    for (let i = 0; i < 50; i++) {
      const c = await kv.lpop('locker:cmds');
      if (!c) break;
      opens.push(c);
    }

    // 3) Return the authoritative state so the tablet stays in sync.
    const s = await kv.get('locker:state');
    const lockers = (s && s.lockers) ? s.lockers : defaultLockers();
    return res.status(200).json({ ok: true, opens, lockers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
