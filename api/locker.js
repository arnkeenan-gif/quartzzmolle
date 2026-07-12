// api/locker.js — ONE serverless function for the whole locker system.
// Vercel Hobby allows max 12 functions, so everything routes through here by an
// "action" field instead of separate endpoints:
//   login / logout / state / open / deposit / clear / oos  -> web panel (cookie auth)
//   sync                                                    -> tablet (device-secret auth)

import { kv } from './_kv.js';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

// SECURITY: never fall back to a guessable default. If these env vars are not
// set in Vercel the system fails closed (no login possible) instead of trusting
// a hardcoded value that anyone can read in this repo.
const CODE = process.env.LOCKER_CODE || '';
const SECRET = process.env.LOCKER_SESSION_SECRET || '';
const CONFIGURED = CODE.length > 0 && SECRET.length > 0 && SECRET !== 'CHANGE_ME_IN_VERCEL_ENV';
const DEVICE_SECRET = process.env.LOCKER_DEVICE_SECRET || '';
const DOORS = 22;
const SESSION_HOURS = 8;
const STALE_MS = 60000; // tablet counts as online if it synced within the last 60s
                        // (was 20s — too tight if the tablet syncs less frequently,
                        //  which showed a false "offline" between heartbeats)
const MAX_FAILS = 5;
const GLOBAL_MAX_FAILS = 50; // backstop across all IPs so header-rotation can't brute force
const LOCK_SECONDS = 900;

// Constant-time string comparison (avoids timing leaks on the passcode).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

function sign(expMs) {
  const data = String(expMs);
  return data + '.' + createHmac('sha256', SECRET).update(data).digest('hex');
}
function cookieStr(v, maxAge) {
  return `lk_sess=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function verify(req) {
  if (!CONFIGURED) return false; // no valid session possible without configured secret
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
async function saveLockers(l) { await kv.set('locker:state', { lockers: l, updated: Date.now() }); }
async function logEvt(ev) {
  await kv.lpush('locker:history', { t: Date.now(), ...ev });
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
  // ── Robust body parsing ──
  // Vercel normally parses JSON automatically, but only when the request has a
  // correct `Content-Type: application/json`. If the tablet's HTTP client sends
  // the sync without that header, the body arrives as a raw string (or Buffer)
  // and req.body.action is undefined -> the request falls through to a 401. Parse
  // it defensively here so the tablet's sync works regardless of Content-Type.
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  // The tablet may also pass its params via the query string (?action=sync&secret=…).
  const action = body.action ||
                 (req.query && req.query.action) ||
                 (req.method === 'GET' && req.query && req.query.secret ? 'sync' : '') ||
                 (req.method === 'GET' ? 'state' : '');

  try {
    // ---------------- ONE-TIME DATA MIGRATION (old Upstash -> new Redis) ----------------
    // Passcode-protected, browser-triggerable:
    //   /api/locker?action=migrate&code=LOCKER_CODE
    // Copies existing data from the old Upstash store (read via @vercel/kv, still
    // reachable through the old KV_REST_API_* env vars) into the new Redis. It
    // lives here rather than in its own api/ file so it adds NO extra serverless
    // function (Vercel Hobby allows max 12). Idempotent and safe: it only ever
    // copies keys that are NOT already in the new DB (so it can never clobber
    // fresh locker/heartbeat data) and self-disables once finished.
    if (action === 'migrate') {
      const code = (body.code || (req.query && req.query.code) || '').toString();
      if (!CODE || !safeEqual(code, CODE)) return res.status(401).json({ error: 'Unauthorized' });
      // ?force=1 RESTORES the old snapshot even if the new DB already holds fresh
      // (empty) keys written by syncs since the switch. It only overwrites the
      // data-bearing keys below — never the live heartbeat (locker:device) or the
      // open-command queue (locker:cmds), which must stay current.
      const force = String((req.query && req.query.force) || body.force || '') === '1';
      if (!force) {
        try { if (await kv.get('migrate:done')) return res.status(200).json({ ok: true, alreadyDone: true, note: 'Allerede migreret. Tilføj &force=1 for at gennemtvinge gendannelse.' }); } catch {}
      }
      let oldkv;
      try { ({ kv: oldkv } = await import('@vercel/kv')); }
      catch (e) { return res.status(500).json({ error: 'Kunne ikke indlæse @vercel/kv (gammel database)', detail: String(e && e.message || e) }); }
      const report = { forced: force, copied: {}, skipped: [], errors: {} };
      const existsNew = async (k) => { try { return !!(await kv.exists(k)); } catch { return false; } };
      // [key, restorable] — restorable keys are overwritten when force=1.
      // locker:device (heartbeat) and locker:cmds (open queue) are never forced.
      // strings / json
      for (const [key, restorable] of [['locker:state', true], ['locker:device', false]]) {
        try {
          if ((!force || !restorable) && await existsNew(key)) { report.skipped.push(key + ' (findes allerede)'); continue; }
          const v = await oldkv.get(key);
          if (v == null) { report.skipped.push(key + ' (tom i gammel)'); continue; }
          await kv.set(key, v); report.copied[key] = 'værdi';
        } catch (e) { report.errors[key] = String(e && e.message || e); }
      }
      // lists (preserve order)
      for (const [key, restorable] of [['pickup:orders', true], ['locker:history', true], ['locker:cmds', false]]) {
        try {
          if ((!force || !restorable) && await existsNew(key)) { report.skipped.push(key + ' (findes allerede)'); continue; }
          const items = (await oldkv.lrange(key, 0, -1)) || [];
          if (!items.length) { report.skipped.push(key + ' (tom i gammel)'); continue; }
          await kv.del(key); for (const it of items) await kv.rpush(key, it);
          report.copied[key] = items.length + ' items';
        } catch (e) { report.errors[key] = String(e && e.message || e); }
      }
      // hash (hset merges fields, so fulfilment marks are never lost)
      for (const key of ['pickup:fulfilled']) {
        try {
          if (!force && await existsNew(key)) { report.skipped.push(key + ' (findes allerede)'); continue; }
          const obj = (await oldkv.hgetall(key)) || {};
          if (!Object.keys(obj).length) { report.skipped.push(key + ' (tom i gammel)'); continue; }
          await kv.hset(key, obj); report.copied[key] = Object.keys(obj).length + ' felter';
        } catch (e) { report.errors[key] = String(e && e.message || e); }
      }
      // optional: visitor-stats sets (best-effort, never forced)
      try {
        const vkeys = (await oldkv.keys('visitors:*')) || [];
        let days = 0;
        for (const key of vkeys) {
          try {
            if (await existsNew(key)) continue;
            const m = (await oldkv.smembers(key)) || [];
            if (!m.length) continue;
            await kv.sadd(key, ...m);
            const ttl = await oldkv.ttl(key); if (ttl && ttl > 0) await kv.expire(key, ttl);
            days++;
          } catch { /* skip this day */ }
        }
        if (days) report.copied['visitors:* (statistik)'] = days + ' dage';
      } catch (e) { report.errors['visitors:*'] = String(e && e.message || e); }
      try { await kv.set('migrate:done', { at: Date.now() }); } catch {}
      report.ok = true;
      report.note = force
        ? 'Gennemtvunget gendannelse færdig — skab-status og ordrer er hentet fra den gamle database.'
        : 'Migrering færdig. Ingenting at slette — endpointet er selv-deaktiveret.';
      return res.status(200).json(report);
    }

    // ---------------- TABLET SYNC ----------------
    if (action === 'sync') {
      // Accept the device secret from the header, the query string OR the body —
      // some HTTP clients silently drop custom headers, which would otherwise
      // reject every sync and leave the panel stuck on "offline".
      const providedSecret = req.headers['x-device-secret']
        || (req.query && req.query.secret)
        || body.secret
        || '';
      if (!DEVICE_SECRET || providedSecret !== DEVICE_SECRET) {
        console.warn('[locker] sync REJECTED — device secret missing or mismatch. configured=%s provided=%s',
          !!DEVICE_SECRET, providedSecret ? 'yes' : 'no');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // The heartbeat is the ONLY thing that keeps the panel "online". Write it
      // first, and from here on NEVER throw a 500 back at the tablet: a single 500
      // response can crash a fragile kiosk sync-loop, which then stops calling home
      // entirely and freezes the panel on "offline" until the tablet is physically
      // restarted. So the heartbeat and every step after it are individually guarded
      // and we ALWAYS return 200 with the fields the tablet expects.
      try { await kv.set('locker:device', { lastSeen: Date.now() }); }
      catch (e) { console.error('[locker] device heartbeat kv.set failed', e); }
      console.log('[locker] sync OK — heartbeat written at', new Date().toISOString());

      let opens = [], lockers = [];
      try {
        const events = Array.isArray(body.events) ? body.events : [];
        if (events.length) {
          lockers = await getLockers();
          for (const ev of events) {
            const t = lockers.find(l => l.door === ev.locker);
            if (t) {
              if (ev.type === 'in') { t.occ = true; t.code = ev.code; t.since = ev.t || Date.now(); }
              else if (ev.type === 'out') { t.occ = false; t.code = null; t.since = 0; }
              else if (ev.type === 'oos') { t.oos = !!ev.value; }
            }
            try {
              await kv.lpush('locker:history', {
                t: ev.t || Date.now(), type: ev.type, locker: ev.locker, code: ev.code || '', source: 'kiosk',
              });
            } catch (e) { /* history is best-effort; never fail the sync over it */ }
          }
          try { await kv.ltrim('locker:history', 0, 499); } catch (e) {}
          await saveLockers(lockers);
        }

        for (let i = 0; i < 50; i++) { const c = await kv.lpop('locker:cmds'); if (!c) break; opens.push(c); }
        lockers = await getLockers();
      } catch (e) {
        console.error('[locker] sync post-heartbeat work failed — returning 200 anyway', e);
      }
      return res.status(200).json({ ok: true, opens, lockers });
    }

    // ---------------- LOGIN / LOGOUT ----------------
    if (action === 'logout') {
      res.setHeader('Set-Cookie', cookieStr('', 0));
      return res.status(200).json({ ok: true });
    }
    if (action === 'login') {
      if (!CONFIGURED) return res.status(503).json({ error: 'Login er ikke konfigureret.' });
      // Prefer Vercel's trusted client IP (x-real-ip) over the spoofable
      // left-most x-forwarded-for entry, and keep a GLOBAL failure backstop so
      // rotating the header can't defeat the lockout entirely.
      const ip = (req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',').pop() || 'unknown').toString().trim();
      const failKey = `locker:fails:${ip}`;
      const globalKey = 'locker:fails:global';
      let fails = 0, gfails = 0;
      try { fails = (await kv.get(failKey)) || 0; } catch {}
      try { gfails = (await kv.get(globalKey)) || 0; } catch {}
      if (fails >= MAX_FAILS || gfails >= GLOBAL_MAX_FAILS) {
        return res.status(429).json({ error: 'For mange forsøg. Prøv igen om lidt.' });
      }
      const code = (body?.code ?? '').toString();
      if (!code || code.length !== CODE.length || !safeEqual(code, CODE)) {
        try { await kv.set(failKey, fails + 1, { ex: LOCK_SECONDS }); } catch {}
        try { await kv.set(globalKey, gfails + 1, { ex: LOCK_SECONDS }); } catch {}
        return res.status(401).json({ error: 'Forkert kode' });
      }
      try { await kv.del(failKey); } catch {}
      try { await kv.del(globalKey); } catch {}
      res.setHeader('Set-Cookie', cookieStr(sign(Date.now() + SESSION_HOURS * 3600 * 1000), SESSION_HOURS * 3600));
      return res.status(200).json({ ok: true });
    }

    // ---------------- everything below requires a valid session ----------------
    if (!verify(req)) return res.status(401).json({ error: 'Unauthorized' });

    if (action === 'state') {
      let lockers = defaultLockers(), history = [], device = { lastSeen: 0 };
      try {
        const s = await kv.get('locker:state'); if (s && s.lockers) lockers = s.lockers;
        history = (await kv.lrange('locker:history', 0, 99)) || [];
        device = (await kv.get('locker:device')) || { lastSeen: 0 };
      } catch {}
      const online = !!(device.lastSeen && Date.now() - device.lastSeen < STALE_MS);
      return res.status(200).json({ lockers, history, device: { lastSeen: device.lastSeen || 0, online }, now: Date.now() });
    }

    const door = parseInt(body?.door, 10);
    const lockers = await getLockers();

    if (action === 'open') {
      if (!(door >= 1 && door <= DOORS)) return res.status(400).json({ error: 'Ugyldig dør' });
      await queueOpen(door);
      await logEvt({ type: 'open', locker: door, code: '', source: 'web' });
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
      await logEvt({ type: 'in', locker: d, code, source: 'web' });
      return res.status(200).json({ ok: true, door: d, code });
    }
    if (action === 'depositmulti') {
      const doors = Array.isArray(body?.doors)
        ? body.doors.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= DOORS) : [];
      if (!doors.length) return res.status(400).json({ error: 'Ingen skabe valgt' });
      const targets = [];
      for (const dn of doors) {
        const t = lockers.find(l => l.door === dn);
        if (!t || t.occ || t.oos) return res.status(409).json({ error: 'Skab ' + dn + ' er ikke ledigt' });
        targets.push(t);
      }
      const code = genCode(lockers);
      const now = Date.now();
      for (const t of targets) { t.occ = true; t.code = code; t.since = now; }
      await saveLockers(lockers);
      for (const t of targets) { await queueOpen(t.door); await logEvt({ type: 'in', locker: t.door, code, source: 'web' }); }
      return res.status(200).json({ ok: true, doors: targets.map(t => t.door), code });
    }
    if (action === 'clear') {
      const t = lockers.find(l => l.door === door);
      if (!t) return res.status(400).json({ error: 'Ugyldig dør' });
      const old = t.code;
      t.occ = false; t.code = null; t.since = 0;
      await saveLockers(lockers);
      await logEvt({ type: 'out', locker: door, code: old || '', source: 'web' });
      return res.status(200).json({ ok: true });
    }
    if (action === 'oos') {
      const t = lockers.find(l => l.door === door);
      if (!t) return res.status(400).json({ error: 'Ugyldig dør' });
      t.oos = !t.oos;
      await saveLockers(lockers);
      await logEvt({ type: t.oos ? 'oos_on' : 'oos_off', locker: door, code: '', source: 'web' });
      return res.status(200).json({ ok: true, oos: t.oos });
    }
    if (action === 'openall') {
      for (let d = 1; d <= DOORS; d++) await queueOpen(d);
      await logEvt({ type: 'openall', locker: 0, code: '', source: 'web' });
      return res.status(200).json({ ok: true, count: DOORS });
    }
    if (action === 'clearall') {
      let n = 0;
      for (const l of lockers) { if (l.occ) { l.occ = false; l.code = null; l.since = 0; n++; } }
      await saveLockers(lockers);
      await logEvt({ type: 'clearall', locker: 0, code: '', source: 'web' });
      return res.status(200).json({ ok: true, cleared: n });
    }

    return res.status(400).json({ error: 'Ukendt handling' });
  } catch (e) {
    console.error('locker error', e);
    return res.status(500).json({ error: 'Serverfejl' });
  }
}
