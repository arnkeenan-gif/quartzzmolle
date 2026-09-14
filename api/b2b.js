// api/b2b.js — Erhvervsportalen (B2B) i ÉN serverless-funktion (12/12 på
// Vercel Hobby). Alt kører via et "action"-felt:
//
//   Kunde (bageri/butik) — logger ind med engangskode på mail, ingen adgangskoder:
//     reqcode  { email }                 -> sender 6-cifret kode (10 min)
//     verify   { email, code }           -> session-cookie 30 dage
//     me                                  -> kundens stamdata + varer/priser
//     order    { lines, note, wishDate } -> opret bestilling (priser låses server-side)
//     myorders                            -> kundens ordrehistorik
//     logout
//
//   Admin (far) — genbruger admin-login-cookien fra /api/locker (lk_sess):
//     admlist                             -> alle B2B-ordrer
//     admsetstatus { id, status, msg }    -> godkend / afvis (+ mail til kunden)
//     admcustomers                        -> kundeliste
//     admaddcustomer { name, email, ... } -> opret kunde
//     admdelcustomer { email }            -> slet kunde
//     admprices / admsetprices            -> B2B-prisliste (ekskl. moms)
//
// e-conomic: når API-nøglerne (ECONOMIC_APP_SECRET + ECONOMIC_GRANT_TOKEN) og
// varenumre er sat op, kobles fakturaoprettelse på godkendelses-trinnet her.
// Indtil da godkender far ordren her og fakturerer som hidtil.

import { kv } from './_kv.js';
import { createHmac, createHash, timingSafeEqual, randomInt, randomBytes } from 'crypto';
import { CATALOG, weightKgFromLabel } from './_catalog.js';

const SECRET = process.env.LOCKER_SESSION_SECRET || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = process.env.B2B_OWNER_EMAIL || 'hello@quartzmolle.dk';
const SITE = 'https://www.quartzmolle.dk';
const SESS_DAYS = 30;
const CODE_TTL = 600;      // engangskoden gælder 10 minutter
const DAYSEC = 86400;

// Visningsnavne til varerne (samme id'er som webshoppen/_catalog.js).
const NAMES = {
  'mariagertoba-type70': 'Mariagertoba · Type 70',
  'dalarna-type85': 'Dalarna · Type 85',
  'dalarna-fuldkorn': 'Dalarna · Fuldkorn',
  'olands-fuldkorn': 'Ølands/Quarna · Fuldkorn',
  'olands-type85': 'Ølands/Quarna · Type 85',
  'purpurhvede-fuldkorn': 'Purpurhvede · Fuldkorn',
  'rod-hvede-fuldkorn': 'Rød hvede · Fuldkorn',
  'rod-hvede-type70': 'Rød hvede · Type 70',
  'rod-hvede-type85': 'Rød hvede · Type 85',
  'rug-fuldkorn': 'Rug · Fuldkorn',
  'spelt-fuldkorn': 'Spelt · Fuldkorn',
  'bla-hvede-fuldkorn': 'Blå hvede · Fuldkorn',
};

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120; }
function clientIp(req) {
  return String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'ukendt').trim();
}
function dayStamp() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── ADMIN-AUTH: samme HMAC-cookie som /api/locker (lk_sess) ─────────────────
function verifyAdmin(req) {
  if (!SECRET || SECRET === 'CHANGE_ME_IN_VERCEL_ENV') return false;
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

// ── KUNDE-SESSIONER: tilfældigt token gemt i Redis (30 dage) ────────────────
function sessCookie(tok, maxAge) {
  return `b2b_sess=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function sessToken(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)b2b_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : '';
}
async function getSession(req) {
  const tok = sessToken(req);
  if (!tok) return null;
  let s = null;
  try { s = await kv.get(`b2b:sess:${tok}`); } catch {}
  if (!s || !s.email) return null;
  let cust = null;
  try { cust = await kv.hget('b2b:customers', s.email); } catch {}
  if (!cust) return null; // kunden er slettet -> sessionen gælder ikke
  return { tok, email: s.email, cust };
}

// ── VARER + PRISER ───────────────────────────────────────────────────────────
// B2B-priser (ekskl. moms) sættes af admin og gemmes i Redis. En vare uden
// sat pris kan stadig bestilles — så står der "aftalt pris" på ordren.
async function getPrices() {
  try { return (await kv.get('b2b:prices')) || {}; } catch { return {}; }
}
function productList(prices) {
  const out = [];
  for (const [id, p] of Object.entries(CATALOG)) {
    for (const label of Object.keys(p.weights)) {
      const key = `${id}|${label}`;
      out.push({
        key, id, label,
        name: NAMES[id] || id,
        image: `images/pose-${id}.jpg`,
        kg: weightKgFromLabel(label),
        price: typeof prices[key] === 'number' ? prices[key] : null,
      });
    }
  }
  return out;
}

// ── MAILS (Resend — samme mønster som resten af sitet) ──────────────────────
async function sendMail(to, subject, html, replyTo) {
  if (!RESEND_KEY) return;
  const body = { from: 'Quartz Mølle <ordre@quartzmolle.dk>', to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Resend ' + r.status);
}

function mailShell(inner) {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#faf7f2;padding:28px 14px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 26px;border:1px solid #eee5d8">
    <div style="font-size:20px;font-weight:800;color:#273071;margin-bottom:4px">Quartz Mølle</div>
    <div style="font-size:12px;color:#6b6256;margin-bottom:18px">Erhverv</div>
    ${inner}
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #eee5d8;font-size:11.5px;color:#6b6256">
      Quartz Mølle · ${SITE.replace('https://', '')}
    </div>
  </div></div>`;
}

function orderLinesHtml(o) {
  const rows = o.lines.map(l =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ead9">${esc(l.name)} · ${esc(l.label)}</td>
     <td style="padding:6px 0;border-bottom:1px solid #f0ead9;text-align:center;white-space:nowrap">${l.qty} stk.</td>
     <td style="padding:6px 0;border-bottom:1px solid #f0ead9;text-align:right;white-space:nowrap">${l.price != null ? (l.price * l.qty).toLocaleString('da-DK') + ' kr.' : 'aftalt pris'}</td></tr>`
  ).join('');
  const totalKg = o.lines.reduce((a, l) => a + l.kg * l.qty, 0);
  const sum = o.lines.reduce((a, l) => a + (l.price != null ? l.price * l.qty : 0), 0);
  const hasOpen = o.lines.some(l => l.price == null);
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:10px 0">${rows}</table>
    <div style="font-size:13px;color:#6b6256">I alt ca. ${totalKg.toLocaleString('da-DK')} kg
    ${sum > 0 ? ' · ' + sum.toLocaleString('da-DK') + ' kr. ekskl. moms' + (hasOpen ? ' (+ varer til aftalt pris)' : '') : ''}</div>
    ${o.note ? `<div style="margin-top:10px;font-size:13px"><b>Bemærkning:</b> ${esc(o.note)}</div>` : ''}
    ${o.wishDate ? `<div style="margin-top:4px;font-size:13px"><b>Ønsket levering:</b> ${esc(o.wishDate)}</div>` : ''}`;
}

// ── PUSH til far (genbruger admin-enhederne fra locker/pushsub) ─────────────
const QM_VAPID_PUBLIC = 'BO1VNQRG3or-Sm9xL0EQoqZ3UUMUYlZXJOCFhhcP0BlG7asMkdSTaaSceGDxkpnnDmTkjE_fLNhoxR9ATeVgHsc';
async function sendB2bPush(order) {
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  if (!priv) return;
  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@quartzmolle.dk', QM_VAPID_PUBLIC, priv);
    let subs = {};
    try { subs = (await kv.hgetall('push:subs')) || {}; } catch {}
    if (!Object.keys(subs).length) return;
    const payload = JSON.stringify({
      title: `Ny B2B-bestilling · #${order.no}`,
      body: `${order.customerName} · ${order.lines.reduce((a, l) => a + l.qty, 0)} stk.`,
      url: '/erhvervsportal', tag: 'b2b-' + order.id,
    });
    await Promise.all(Object.entries(subs).map(async ([k, sub]) => {
      try { await webpush.sendNotification(sub, payload); }
      catch (e) {
        const c = e && e.statusCode;
        if (c === 404 || c === 410) { try { await kv.hdel('push:subs', k); } catch {} }
      }
    }));
  } catch (e) { console.error('b2b push failed:', e && e.message); }
}

// ── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const body = req.body || {};
  const action = String(body.action || '');

  try {
    // ── KUNDE-FLOW ──────────────────────────────────────────────────────────
    if (action === 'reqcode') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return res.status(400).json({ ok: false, error: 'Skriv en gyldig e-mailadresse.' });
      // Svar ALTID pænt ok — ingen skal kunne aflure, hvilke mails der er kunder.
      let cust = null;
      try { cust = await kv.hget('b2b:customers', email); } catch {}
      if (!cust) return res.status(200).json({ ok: true });
      // Lofter: 5 koder pr. mail pr. time, 20 pr. IP pr. døgn.
      const ip = clientIp(req);
      let nMail = 0, nIp = 0;
      try {
        nMail = await kv.incr(`b2b:codelimit:${email}`); await kv.expire(`b2b:codelimit:${email}`, 3600);
        nIp = await kv.incr(`b2b:codeip:${ip}:${dayStamp()}`); await kv.expire(`b2b:codeip:${ip}:${dayStamp()}`, DAYSEC);
      } catch {}
      if (nMail > 5 || nIp > 20) return res.status(200).json({ ok: true });
      const code = String(randomInt(100000, 1000000));
      await kv.set(`b2b:code:${email}`, { code }, { ex: CODE_TTL });
      try { await kv.del(`b2b:tries:${email}`); } catch {}
      try {
        await sendMail(email, `Din login-kode: ${code}`, mailShell(
          `<p style="font-size:15px;margin:0 0 14px">Her er din engangskode til erhvervsportalen:</p>
           <div style="background:#f6f8ff;border:2px dashed #3a4599;border-radius:12px;padding:16px;text-align:center;font-size:30px;font-weight:800;letter-spacing:6px;color:#273071">${code}</div>
           <p style="font-size:13px;color:#6b6256;margin:14px 0 0">Koden gælder i 10 minutter. Har du ikke bedt om den, kan du roligt ignorere denne mail.</p>`));
      } catch (e) { console.error('b2b code mail failed:', e && e.message); }
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify') {
      const email = normEmail(body.email);
      const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
      // ÉN fælles fejlbesked til ALLE afvisninger. Forskellige beskeder ("koden
      // er udløbet" vs "forkert kode") roebede, om en given mailadresse
      // overhovedet er kunde hos os.
      const DENY = { ok: false, error: 'Forkert eller udløbet kode.' };
      if (!validEmail(email) || code.length !== 6) return res.status(400).json(DENY);

      // Loft pr. IP: verify havde ingen begraensning overhovedet - kun en
      // taeller inde i selve koden, som kunne omgaas (se nedenfor).
      const vip = clientIp(req);
      const vday = dayStamp();
      let vTries = 0;
      try {
        vTries = await kv.incr(`b2b:vip:${vip}:${vday}`);
        if (vTries === 1) await kv.expire(`b2b:vip:${vip}:${vday}`, DAYSEC);
      } catch { vTries = 999; }          // taelleren utilgaengelig -> fejl LUKKET
      if (vTries > 50) return res.status(429).json(DENY);

      let rec = null;
      try { rec = await kv.get(`b2b:code:${email}`); } catch {}
      if (!rec) return res.status(400).json(DENY);

      // ATOMISK forsoegstaeller i sin EGEN noegle. Foer laa "tries" inde i selve
      // kode-posten og blev skrevet tilbage med kv.set - to problemer: samtidige
      // gaet laeste alle den samme vaerdi (kapløb), og hver skrivning gav koden
      // en frisk 10-minutters levetid, saa et angreb kunne holde den i live for evigt.
      let tries = 0;
      try {
        tries = await kv.incr(`b2b:tries:${email}`);
        if (tries === 1) await kv.expire(`b2b:tries:${email}`, CODE_TTL);
      } catch { tries = 99; }
      if (tries > 5) {
        try { await kv.del(`b2b:code:${email}`, `b2b:tries:${email}`); } catch {}
        return res.status(400).json(DENY);
      }

      const okCode = (() => {
        const a = createHash('sha256').update(String(rec.code)).digest();
        const b = createHash('sha256').update(code).digest();
        try { return timingSafeEqual(a, b); } catch { return false; }
      })();
      if (!okCode) return res.status(400).json(DENY);
      try { await kv.del(`b2b:code:${email}`, `b2b:tries:${email}`); } catch {}
      const tok = randomBytes(24).toString('base64url');
      await kv.set(`b2b:sess:${tok}`, { email, t: Date.now() }, { ex: SESS_DAYS * DAYSEC });
      res.setHeader('Set-Cookie', sessCookie(tok, SESS_DAYS * DAYSEC));
      return res.status(200).json({ ok: true });
    }

    if (action === 'logout') {
      const tok = sessToken(req);
      if (tok) { try { await kv.del(`b2b:sess:${tok}`); } catch {} }
      res.setHeader('Set-Cookie', sessCookie('', 0));
      return res.status(200).json({ ok: true });
    }

    if (action === 'me') {
      const s = await getSession(req);
      if (!s) return res.status(401).json({ ok: false });
      const prices = await getPrices();
      return res.status(200).json({
        ok: true,
        customer: { name: s.cust.name, email: s.email, contact: s.cust.contact || '', cvr: s.cust.cvr || '' },
        products: productList(prices),
      });
    }

    if (action === 'order') {
      const s = await getSession(req);
      if (!s) return res.status(401).json({ ok: false });
      const prices = await getPrices();
      const valid = new Map(productList(prices).map(p => [p.key, p]));
      const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 40) : [];
      const lines = [];
      for (const l of rawLines) {
        const p = valid.get(String(l && l.key || ''));
        const qty = Math.floor(Number(l && l.qty));
        if (!p || !Number.isFinite(qty) || qty < 1 || qty > 500) continue;
        lines.push({ key: p.key, name: p.name, label: p.label, kg: p.kg, qty, price: p.price });
      }
      if (!lines.length) return res.status(400).json({ ok: false, error: 'Vælg mindst én vare.' });
      // Loft: 20 bestillinger pr. kunde pr. døgn (værn mod fejl/løbske scripts).
      let n = 0;
      try { n = await kv.incr(`b2b:orderlimit:${s.email}:${dayStamp()}`); await kv.expire(`b2b:orderlimit:${s.email}:${dayStamp()}`, DAYSEC); } catch {}
      if (n > 20) return res.status(429).json({ ok: false, error: 'For mange bestillinger i dag — kontakt os direkte.' });

      const no = await kv.incr('b2b:orderno');
      const id = 'b2b_' + Date.now().toString(36) + '_' + randomBytes(4).toString('hex');
      const wishDate = String(body.wishDate || '').slice(0, 10).replace(/[^0-9-]/g, '');
      const order = {
        id, no, t: Date.now(), status: 'ny',
        email: s.email, customerName: s.cust.name || s.email, cvr: s.cust.cvr || '',
        lines, note: String(body.note || '').slice(0, 500), wishDate,
      };
      await kv.hset('b2b:orders', { [id]: order });

      // Besked til far (push + mail) og kvittering til kunden.
      sendB2bPush(order).catch(() => {});
      try {
        await sendMail(OWNER_EMAIL, `Ny B2B-bestilling #${no} — ${order.customerName}`, mailShell(
          `<h2 style="font-size:17px;margin:0 0 6px">Ny bestilling #${no}</h2>
           <div style="font-size:14px;margin-bottom:4px"><b>${esc(order.customerName)}</b> · ${esc(s.email)}${order.cvr ? ' · CVR ' + esc(order.cvr) : ''}</div>
           ${orderLinesHtml(order)}
           <p style="font-size:13px;margin:16px 0 0">Godkend eller afvis bestillingen på <a href="${SITE}/erhvervsportal" style="color:#273071;font-weight:700">erhvervsportalen</a>.</p>`), s.email);
      } catch (e) { console.error('b2b owner mail failed:', e && e.message); }
      try {
        await sendMail(s.email, `Vi har modtaget din bestilling #${no}`, mailShell(
          `<h2 style="font-size:17px;margin:0 0 6px">Tak for din bestilling</h2>
           <p style="font-size:14px;margin:0 0 6px">Vi har modtaget bestilling <b>#${no}</b> og vender tilbage med en bekræftelse.</p>
           ${orderLinesHtml(order)}`));
      } catch (e) { console.error('b2b customer mail failed:', e && e.message); }

      return res.status(200).json({ ok: true, no });
    }

    if (action === 'myorders') {
      const s = await getSession(req);
      if (!s) return res.status(401).json({ ok: false });
      let all = {};
      try { all = (await kv.hgetall('b2b:orders')) || {}; } catch {}
      const mine = Object.values(all).filter(o => o && o.email === s.email)
        .sort((a, b) => b.t - a.t).slice(0, 50)
        .map(o => ({ no: o.no, t: o.t, status: o.status, lines: o.lines, note: o.note, wishDate: o.wishDate, statusMsg: o.statusMsg || '' }));
      return res.status(200).json({ ok: true, orders: mine });
    }

    // ── ADMIN-FLOW (fars login fra /api/locker) ─────────────────────────────
    if (!verifyAdmin(req)) return res.status(401).json({ ok: false, error: 'Ikke logget ind' });

    if (action === 'admlist') {
      let all = {};
      try { all = (await kv.hgetall('b2b:orders')) || {}; } catch {}
      const orders = Object.values(all).filter(Boolean).sort((a, b) => b.t - a.t).slice(0, 200);
      return res.status(200).json({ ok: true, orders });
    }

    if (action === 'admsetstatus') {
      const id = String(body.id || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
      const status = body.status === 'godkendt' ? 'godkendt' : (body.status === 'afvist' ? 'afvist' : null);
      if (!id || !status) return res.status(400).json({ ok: false, error: 'Ugyldig anmodning.' });
      let order = null;
      try { order = await kv.hget('b2b:orders', id); } catch {}
      if (!order) return res.status(404).json({ ok: false, error: 'Ordren findes ikke.' });
      order.status = status;
      order.statusMsg = String(body.msg || '').slice(0, 300);
      order.statusT = Date.now();
      await kv.hset('b2b:orders', { [id]: order });
      try {
        if (status === 'godkendt') {
          await sendMail(order.email, `Din bestilling #${order.no} er bekræftet`, mailShell(
            `<h2 style="font-size:17px;margin:0 0 6px">Bestilling #${order.no} er bekræftet</h2>
             <p style="font-size:14px;margin:0 0 6px">Vi pakker din ordre${order.wishDate ? ' til levering omkring <b>' + esc(order.wishDate) + '</b>' : ''}. Faktura følger.</p>
             ${order.statusMsg ? '<p style="font-size:14px">' + esc(order.statusMsg) + '</p>' : ''}
             ${orderLinesHtml(order)}`));
        } else {
          await sendMail(order.email, `Om din bestilling #${order.no}`, mailShell(
            `<h2 style="font-size:17px;margin:0 0 6px">Bestilling #${order.no}</h2>
             <p style="font-size:14px;margin:0 0 6px">Vi kan desværre ikke gennemføre bestillingen som afgivet.</p>
             ${order.statusMsg ? '<p style="font-size:14px"><b>Besked fra møllen:</b> ' + esc(order.statusMsg) + '</p>' : ''}
             <p style="font-size:13px;color:#6b6256">Svar på denne mail, så finder vi en løsning.</p>`, OWNER_EMAIL));
        }
      } catch (e) { console.error('b2b status mail failed:', e && e.message); }
      return res.status(200).json({ ok: true });
    }

    if (action === 'admcustomers') {
      let all = {};
      try { all = (await kv.hgetall('b2b:customers')) || {}; } catch {}
      const customers = Object.entries(all).map(([email, c]) => ({ email, ...(c || {}) }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'da'));
      return res.status(200).json({ ok: true, customers });
    }

    if (action === 'admaddcustomer') {
      const email = normEmail(body.email);
      const name = String(body.name || '').trim().slice(0, 80);
      if (!validEmail(email) || !name) return res.status(400).json({ ok: false, error: 'Navn og gyldig e-mail er påkrævet.' });
      const cust = {
        name,
        contact: String(body.contact || '').trim().slice(0, 80),
        phone: String(body.phone || '').trim().slice(0, 30),
        cvr: String(body.cvr || '').replace(/\D/g, '').slice(0, 8),
        address: String(body.address || '').trim().slice(0, 160),
        t: Date.now(),
      };
      let existed = null;
      try { existed = await kv.hget('b2b:customers', email); } catch {}
      await kv.hset('b2b:customers', { [email]: cust });
      // Ny kunde: send automatisk invitation — de logger selv ind med deres
      // e-mail + engangskode, så der er ingen adgangskoder at administrere.
      if (!existed) {
        try {
          await sendMail(email, 'Velkommen til Quartz Mølles erhvervsportal', mailShell(
            `<h2 style="font-size:17px;margin:0 0 6px">Velkommen, ${esc(cust.name)}</h2>
             <p style="font-size:14px;margin:0 0 10px">I kan nu bestille mel direkte hos Quartz Mølle på vores erhvervsportal — med jeres aftalte priser og fuld ordrehistorik.</p>
             <p style="font-size:14px;margin:0 0 16px"><b>Sådan gør I:</b> Åbn portalen, skriv denne e-mailadresse (${esc(email)}), og I får straks en engangskode på mail. Ingen adgangskoder — koden sendes automatisk, hver gang I skal logge ind.</p>
             <div style="text-align:center;margin:18px 0"><a href="${SITE}/erhverv" style="display:inline-block;background:#273071;color:#fff;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;text-decoration:none">Åbn erhvervsportalen</a></div>
             <p style="font-size:12.5px;color:#6b6256;margin:14px 0 0">Spørgsmål? Svar på denne mail, så vender vi tilbage.</p>`), OWNER_EMAIL);
        } catch (e) { console.error('b2b invite mail failed:', e && e.message); }
      }
      return res.status(200).json({ ok: true, invited: !existed });
    }

    if (action === 'admdelcustomer') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return res.status(400).json({ ok: false });
      try { await kv.hdel('b2b:customers', email); } catch {}
      return res.status(200).json({ ok: true });
    }

    if (action === 'admprices') {
      const prices = await getPrices();
      return res.status(200).json({ ok: true, products: productList(prices) });
    }

    if (action === 'admsetprices') {
      const incoming = body.prices && typeof body.prices === 'object' ? body.prices : {};
      const validKeys = new Set(productList({}).map(p => p.key));
      const prices = await getPrices();
      for (const [key, v] of Object.entries(incoming)) {
        if (!validKeys.has(key)) continue;
        if (v === null || v === '') { delete prices[key]; continue; }
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0 && n <= 100000) prices[key] = Math.round(n * 100) / 100;
      }
      await kv.set('b2b:prices', prices);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Ukendt handling.' });
  } catch (e) {
    console.error('b2b error:', e);
    return res.status(500).json({ ok: false, error: 'Noget gik galt. Prøv igen.' });
  }
}
