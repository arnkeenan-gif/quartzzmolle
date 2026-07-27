// api/log-visit.js — Logs a visitor heartbeat to Vercel KV
//
// Called by every page on the site every 30 seconds.
// Stores: visitor IDs with timestamps for "active now" + daily counters.

import { kv } from './_kv.js';
import { randomInt } from 'crypto';

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

  // ── NYHEDSBREV: tilmelding med 10% velkomstrabat ──
  // Folded into this (public) endpoint so it adds no extra serverless function.
  let nlBody = req.body;
  if (typeof nlBody === 'string') { try { nlBody = JSON.parse(nlBody); } catch { nlBody = {}; } }
  if (nlBody && nlBody.action === 'newsletter') {
    return handleNewsletter(req, res, nlBody);
  }

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

// ── NEWSLETTER SIGNUP ────────────────────────────────────────────────────────
// Stores the email in Redis (newsletter:emails hash) together with a UNIQUE
// single-use 10% discount code created in Stripe for that subscriber, and sends
// the welcome email with the code via Resend. Duplicate signups return ok
// without re-sending, so the form can't be abused to spam someone's inbox.
const FALLBACK_CODE = 'VELKOMMEN10';

// Normalise an address so alias tricks can't harvest extra codes:
// everything after "+" in the local part is dropped for all domains, and dots
// in the local part are dropped for gmail (where they're ignored anyway).
function normalizeEmail(email) {
  const at = email.lastIndexOf('@');
  let local = email.slice(0, at), domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}

const MAX_CODES_PER_IP = 3;          // per 30 days
const IP_WINDOW_SECONDS = 30 * 86400;

async function handleNewsletter(req, res, body) {
  try {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
      return res.status(400).json({ ok: false, error: 'Skriv en gyldig e-mailadresse.' });
    }
    const key = normalizeEmail(email);
    const lang = String(body.lang || 'da') === 'en' ? 'en' : 'da';

    // Dedupe on the NORMALISED address: name+2@gmail.com can't harvest a second
    // code for name@gmail.com.
    let existing = null;
    try { existing = await kv.hget('newsletter:emails', key); } catch {}
    if (existing) return res.status(200).json({ ok: true, already: true });

    // IP throttle: collect the signup IP and only mint codes for the first few
    // signups per IP per 30 days. Further signups still join the list but get
    // no code (the response stays ok so abusers learn nothing).
    const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    let ipCount = 0;
    try {
      ipCount = await kv.incr(`newsletter:ipcount:${ip}`);
      if (ipCount === 1) await kv.expire(`newsletter:ipcount:${ip}`, IP_WINDOW_SECONDS);
    } catch {}
    const allowCode = ipCount <= MAX_CODES_PER_IP;

    let code = null;
    if (allowCode) {
      try { code = await createUniqueDiscountCode(); } catch (e) { console.error('unique code failed:', (e && e.raw && e.raw.message) || (e && e.message), '| type:', e && e.type, '| code:', e && e.code); }
      if (!code) {
        try { await ensureFallbackPromo(); code = FALLBACK_CODE; }
        catch (e) { console.error('fallback promo failed too:', (e && e.raw && e.raw.message) || (e && e.message)); code = null; }
      }
    } else {
      console.warn('newsletter: IP over code limit, no code minted', ip);
    }

    try { await kv.hset('newsletter:emails', { [key]: { t: Date.now(), code, email, ip } }); } catch (e) {
      console.error('newsletter store failed:', e.message);
      return res.status(500).json({ ok: false, error: 'Kunne ikke gemme tilmeldingen. Prøv igen.' });
    }

    // Welcome email (best-effort — the signup itself is saved). Over-limit
    // signups get the welcome WITHOUT a discount code.
    try { await sendWelcomeEmail(email, code, lang); } catch (e) { console.error('welcome email failed:', e.message); }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('newsletter error:', e);
    return res.status(500).json({ ok: false, error: 'Noget gik galt. Prøv igen.' });
  }
}

// One shared 10% coupon (created once, id cached in Redis) + a fresh promotion
// code per subscriber, limited to a SINGLE redemption — so every email gets its
// own personal code that stops working after one order.
async function getSharedCouponId(stripe) {
  let id = null;
  try { id = await kv.get('newsletter:couponId'); } catch {}
  if (id) {
    try { await stripe.coupons.retrieve(id); return id; } catch { /* deleted — recreate */ }
  }
  const coupon = await stripe.coupons.create({
    percent_off: 10, duration: 'once', name: 'Nyhedsbrev – 10% velkomstrabat',
  });
  try { await kv.set('newsletter:couponId', coupon.id); } catch {}
  return coupon.id;
}

function randomCode() {
  // No 0/O/1/I — codes are easy to read and type. Format: QM10-XXXXXX
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[randomInt(chars.length)];
  return 'QM10' + s;
}

async function createUniqueDiscountCode() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  const couponId = await getSharedCouponId(stripe);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomCode();
    try {
      await stripe.promotionCodes.create({ coupon: couponId, code, max_redemptions: 1 });
      return code;
    } catch (e) {
      if (e && e.code === 'resource_already_exists') continue; // collision — retry
      throw e;
    }
  }
  return null;
}

// Shared fallback code (multi-use) — only used if unique-code creation fails.
async function ensureFallbackPromo() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  const found = await stripe.promotionCodes.list({ code: FALLBACK_CODE, limit: 1 });
  if (found.data && found.data.length) return;
  const couponId = await getSharedCouponId(stripe);
  await stripe.promotionCodes.create({ coupon: couponId, code: FALLBACK_CODE });
}

async function sendWelcomeEmail(email, code, lang) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const en = lang === 'en';
  const T = en ? {
    heading: 'Thank you for subscribing',
    welcome: "Welcome to Quartz Mølle's newsletter.",
    first: "You'll be among the first to hear about <strong>new flour varieties</strong>, news from the mill, recipes and the season's grain.",
    codeLabel: 'Your personal discount code – 10% off your next order',
    codeHow: 'Enter the code in the "Add promotion code" field at checkout. The code is personal and can be used once.',
    cta: 'Shop our flour',
    footer1: 'You are receiving this email because you signed up at quartzmolle.dk.',
    footer2: 'To unsubscribe, reply to this email with "Unsubscribe".',
    subjectCode: 'Welcome! Your personal discount code: 10% off your next order 🌾',
    subjectNoCode: "Welcome to Quartz Mølle's newsletter 🌾",
  } : {
    heading: 'Tak for din tilmelding',
    welcome: 'Velkommen til Quartz Mølles nyhedsbrev.',
    first: 'Du bliver blandt de første til at høre om <strong>nye melvarianter</strong>, nyheder fra møllen, opskrifter og sæsonens korn.',
    codeLabel: 'Din personlige rabatkode – 10% på din næste ordre',
    codeHow: 'Indtast koden i feltet "Tilføj rabatkode" ved betalingen. Koden er personlig og kan bruges én gang.',
    cta: 'Se vores mel',
    footer1: 'Du modtager denne mail, fordi du tilmeldte dig på quartzmolle.dk.',
    footer2: 'Ønsker du at afmelde, så svar på denne mail med "Afmeld".',
    subjectCode: 'Velkommen! Din personlige rabatkode: 10% på din næste ordre 🌾',
    subjectNoCode: 'Velkommen til Quartz Mølles nyhedsbrev 🌾',
  };
  const codeBlock = code ? `
    <div style="background:#fff;border:2px dashed #3a4599;border-radius:14px;padding:20px;text-align:center;margin:0 0 8px;">
      <div style="font-size:13px;color:#6b6256;margin-bottom:6px;">${T.codeLabel}</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:2px;color:#273071;">${code}</div>
    </div>
    <p style="text-align:center;font-size:13px;color:#6b6256;margin:0 0 22px;">${T.codeHow}</p>` : '';
  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:30px 24px;background:#faf7f2;border-radius:16px;color:#1a1611;">
    <div style="text-align:center;margin-bottom:18px;">
      <img src="https://www.quartzmolle.dk/images/qm-icon-192.png" alt="Quartz Mølle" width="64" height="64" style="border-radius:50%;">
    </div>
    <h2 style="color:#273071;text-align:center;margin:0 0 8px;">${T.heading}</h2>
    <p style="text-align:center;margin:0 0 6px;color:#4a463f;">${T.welcome}</p>
    <p style="text-align:center;margin:0 0 20px;color:#4a463f;">${T.first}</p>
    ${codeBlock}
    <div style="text-align:center;margin-bottom:26px;">
      <a href="https://www.quartzmolle.dk/shop" style="background:#273071;color:#fff;text-decoration:none;font-weight:600;padding:13px 30px;border-radius:10px;display:inline-block;">${T.cta}</a>
    </div>
    <p style="font-size:11.5px;color:#9b9488;text-align:center;line-height:1.6;margin:0;">
      ${T.footer1}<br>
      ${T.footer2}<br>
      Quartz Mølle · Suså Landevej 101, 4160 Herlufmagle · CVR 42117188
    </p>
  </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'Quartz Mølle <order@quartzmolle.dk>',
      to: [email],
      subject: code ? T.subjectCode : T.subjectNoCode,
      html,
    }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status);
}
