// api/locker.js — ONE serverless function for the whole locker system.
// Vercel Hobby allows max 12 functions, so everything routes through here by an
// "action" field instead of separate endpoints:
//   login / logout / state / open / deposit / clear / oos  -> web panel (cookie auth)
//   sync                                                    -> tablet (device-secret auth)

import { kv } from './_kv.js';
import { createHmac, createHash, timingSafeEqual, randomUUID, randomInt } from 'crypto';

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
  // Sammenlign HASHES, ikke raa strenge: saa er sammenligningen altid lige lang,
  // og et forkert gaet roeber ikke laengden af den rigtige kode.
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  try { return timingSafeEqual(ha, hb); } catch { return false; }
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
  do { c = String(randomInt(100000, 1000000)); } while (used.has(c));
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
    // FJERNET (sikkerhed): 'migrate' og 'promotest' var engangs-vedligeholdelses-
    // grene, der godkendte den samme LOCKER_CODE som logins - men UDEN forsoegs-
    // taeller og FOER session-gaten nedenfor. De var dermed ubegraensede orakler,
    // hvor koden kunne gaettes uden nogensinde at udloese laasningen paa login.
    // Migreringen er forlaengst gennemfoert, og promotest var ren diagnostik.

    // ---------------- DIAGNOSE: kan Stripe oprette rabatkoder? ----------------
    // /api/locker?action=promotest&code=LOCKER_CODE — runs the exact same Stripe
    // calls the newsletter uses and reports each step's precise error, so a
    // failing unique-code pipeline can be diagnosed from the browser.

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
            // VALIDÉR ved skrivning. Felterne kom foer ind uaendret fra tabletten
            // og blev gemt raat - og panelet skriver dem direkte ud i sin HTML.
            // En vilkaarlig streng kunne dermed blive til kode, der koerer i
            // ejerens browser, naeste gang skabsoversigten aabnes.
            const evType = ['in', 'out', 'oos'].includes(ev && ev.type) ? ev.type : null;
            if (!evType) continue;
            const evDoor = Number.isInteger(ev.locker) && ev.locker >= 1 && ev.locker <= DOORS ? ev.locker : null;
            const evCode = String((ev && ev.code) || '').replace(/\D/g, '').slice(0, 6);
            const evT = Number.isFinite(Number(ev && ev.t)) ? Number(ev.t) : Date.now();

            const t = evDoor ? lockers.find(l => l.door === evDoor) : null;
            if (t) {
              if (evType === 'in') { t.occ = true; t.code = evCode || null; t.since = evT; }
              else if (evType === 'out') { t.occ = false; t.code = null; t.since = 0; }
              else if (evType === 'oos') { t.oos = !!ev.value; }
            }
            try {
              await kv.lpush('locker:history', {
                t: evT, type: evType, locker: evDoor, code: evCode, source: 'kiosk',
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

      // ATOMISK taelling. Tidligere blev taelleren laest, lagt 1 til i JavaScript
      // og skrevet tilbage - saa 500 samtidige gaet alle laeste 0, alle slap
      // igennem, og alle skrev 1. Laasningen kunne dermed omgaas fuldstaendigt med
      // parallelle kald. kv.incr er atomisk, saa hvert kald i luften ser de andre.
      let fails = 0;
      try {
        fails = await kv.incr(failKey);
        if (fails === 1) await kv.expire(failKey, LOCK_SECONDS);
      } catch { fails = MAX_FAILS + 1; }   // kan taelleren ikke naas, fejler vi LUKKET
      if (fails > MAX_FAILS) {
        return res.status(429).json({ error: 'For mange forsøg. Prøv igen om lidt.' });
      }

      // Global nødbremse mod header-rotation. Den maa ALDRIG kunne laase ejeren
      // ude: kun kald fra en IP, der SELV har fejlet, rammes af den globale graense.
      let gfails = 0;
      try { gfails = Number(await kv.get(globalKey)) || 0; } catch {}
      if (gfails >= GLOBAL_MAX_FAILS && fails > 1) {
        return res.status(429).json({ error: 'For mange forsøg. Prøv igen om lidt.' });
      }

      const code = (body?.code ?? '').toString();
      if (!code || !safeEqual(code, CODE)) {
        try {
          const g = await kv.incr(globalKey);
          if (g === 1) await kv.expire(globalKey, LOCK_SECONDS);
        } catch {}
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

    // ── PUSH NOTIFICATIONS (admin devices) ──
    // pushsub: save this browser's push subscription so the Stripe webhook can
    // notify the owner's phone(s) about new orders. pushtest: send a test push.
    if (action === 'pushsub') {
      const sub = body.sub;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ error: 'Ugyldig tilmelding' });
      }
      const key = createHmac('sha256', 'pushsub').update(String(sub.endpoint)).digest('hex').slice(0, 24);
      await kv.hset('push:subs', { [key]: sub });
      return res.status(200).json({ ok: true });
    }
    // Newsletter subscriber list for the admin (email + signup time).
    if (action === 'alertsclear') {
      try { await kv.del('alert:log'); } catch {}
      return res.status(200).json({ ok: true });
    }

    if (action === 'newsletterlist') {
      let all = {};
      try { all = (await kv.hgetall('newsletter:emails')) || {}; } catch {}
      const emails = Object.entries(all)
        .map(([key, v]) => ({ email: (v && v.email) || key, t: (v && v.t) || 0, code: (v && v.code) || '', ip: (v && v.ip) || '' }))
        .sort((a, b) => b.t - a.t);
      return res.status(200).json({ ok: true, count: emails.length, emails });
    }

    if (action === 'pushtest') {
      // Mirror the real order notification so the test previews the actual look
      // (iOS adds the app name on top by itself — don't repeat it in the title).
      const result = await sendPushToAll({
        title: 'Ny ordre – 99,00 kr. (test)', body: 'Test Kunde · Click & Collect (afhentning)', url: '/admin', tag: 'qm-test',
      });
      return res.status(200).json({ ok: true, ...result });
    }

    return res.status(400).json({ error: 'Ukendt handling' });
  } catch (e) {
    console.error('locker error', e);
    return res.status(500).json({ error: 'Serverfejl' });
  }
}

// Send a Web Push to every stored admin subscription. The VAPID public key is
// the same one embedded in admin.html; the PRIVATE key lives only in Vercel env
// (VAPID_PRIVATE_KEY). Dead subscriptions (404/410) are pruned automatically.
const QM_VAPID_PUBLIC = 'BO1VNQRG3or-Sm9xL0EQoqZ3UUMUYlZXJOCFhhcP0BlG7asMkdSTaaSceGDxkpnnDmTkjE_fLNhoxR9ATeVgHsc';
async function sendPushToAll(payloadObj) {
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  if (!priv) return { sent: 0, error: 'VAPID_PRIVATE_KEY mangler i Vercel env' };
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@quartzmolle.dk', QM_VAPID_PUBLIC, priv);
  let subs = {};
  try { subs = (await kv.hgetall('push:subs')) || {}; } catch {}
  const payload = JSON.stringify(payloadObj);
  let sent = 0;
  await Promise.all(Object.entries(subs).map(async ([k, sub]) => {
    try { await webpush.sendNotification(sub, payload); sent++; }
    catch (e) {
      const c = e && e.statusCode;
      if (c === 404 || c === 410) { try { await kv.hdel('push:subs', k); } catch {} }
    }
  }));
  return { sent, total: Object.keys(subs).length };
}
