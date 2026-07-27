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
// Stores the email in Redis (newsletter:emails hash), makes sure the 10%
// welcome promotion code exists in Stripe (VELKOMMEN10), and
// sends the welcome email with the code via Resend. Duplicate signups return ok
// without re-sending, so the form can't be abused to spam someone's inbox.
const NEWSLETTER_CODE = 'VELKOMMEN10';

async function handleNewsletter(req, res, body) {
  try {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
      return res.status(400).json({ ok: false, error: 'Skriv en gyldig e-mailadresse.' });
    }

    // Dedupe: already on the list → done (no second email).
    let existing = null;
    try { existing = await kv.hget('newsletter:emails', email); } catch {}
    if (existing) return res.status(200).json({ ok: true, already: true });

    try { await kv.hset('newsletter:emails', { [email]: { t: Date.now() } }); } catch (e) {
      console.error('newsletter store failed:', e.message);
      return res.status(500).json({ ok: false, error: 'Kunne ikke gemme tilmeldingen. Prøv igen.' });
    }

    // Make sure the promotion code exists in Stripe (10% off).
    try { await ensureWelcomePromo(); } catch (e) { console.error('promo ensure failed:', e.message); }

    // Welcome email with the code (best-effort — the signup itself is saved).
    try { await sendWelcomeEmail(email); } catch (e) { console.error('welcome email failed:', e.message); }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('newsletter error:', e);
    return res.status(500).json({ ok: false, error: 'Noget gik galt. Prøv igen.' });
  }
}

// Create the Stripe coupon + promotion code on first use; no dashboard work needed.
async function ensureWelcomePromo() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  const found = await stripe.promotionCodes.list({ code: NEWSLETTER_CODE, limit: 1 });
  if (found.data && found.data.length) return;
  const coupon = await stripe.coupons.create({
    percent_off: 10, duration: 'once', name: 'Nyhedsbrev – 10% velkomstrabat',
  });
  await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: NEWSLETTER_CODE,
  });
}

async function sendWelcomeEmail(email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:30px 24px;background:#faf7f2;border-radius:16px;color:#1a1611;">
    <div style="text-align:center;margin-bottom:18px;">
      <img src="https://www.quartzmolle.dk/images/qm-icon-192.png" alt="Quartz Mølle" width="64" height="64" style="border-radius:50%;">
    </div>
    <h2 style="color:#273071;text-align:center;margin:0 0 8px;">Velkommen til Quartz Mølle</h2>
    <p style="text-align:center;margin:0 0 20px;color:#4a463f;">Tak fordi du tilmeldte dig vores nyhedsbrev. Her er din velkomstgave:</p>
    <div style="background:#fff;border:2px dashed #3a4599;border-radius:14px;padding:20px;text-align:center;margin:0 0 8px;">
      <div style="font-size:13px;color:#6b6256;margin-bottom:6px;">10% på din næste ordre med koden</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:3px;color:#273071;">${NEWSLETTER_CODE}</div>
    </div>
    <p style="text-align:center;font-size:13px;color:#6b6256;margin:0 0 22px;">Indtast koden i feltet "Tilføj rabatkode" ved betalingen.</p>
    <div style="text-align:center;margin-bottom:26px;">
      <a href="https://www.quartzmolle.dk/shop" style="background:#273071;color:#fff;text-decoration:none;font-weight:600;padding:13px 30px;border-radius:10px;display:inline-block;">Se vores mel</a>
    </div>
    <p style="font-size:11.5px;color:#9b9488;text-align:center;line-height:1.6;margin:0;">
      Du modtager denne mail, fordi du tilmeldte dig på quartzmolle.dk.<br>
      Ønsker du at afmelde, så svar på denne mail med "Afmeld".<br>
      Quartz Mølle · Suså Landevej 101, 4160 Herlufmagle · CVR 42117188
    </p>
  </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'Quartz Mølle <order@quartzmolle.dk>',
      to: [email],
      subject: 'Din rabatkode: 10% på din næste ordre 🌾',
      html,
    }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status);
}
