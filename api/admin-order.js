// api/admin-order.js — Unified admin order endpoint (detail + search + refund).
//
// Kept as ONE serverless function so the project stays within Vercel's 12-function
// limit. Routing:
//   GET  ?id=cs_...        → full order detail (items, customer, address, card, refund state)
//   GET  ?q=<text>         → search ALL orders (any date) by nr / name / e-mail / city
//   POST { id, code[,amount] } → refund (full or partial) after a 6-digit code
//
// Auth: shares the /locker session cookie (lk_sess) — same passcode as /locker,
//       /fulfill and the admin dashboard.

import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || '';
// Refund security code — lives ONLY in the Vercel env, never in the source.
const REFUND_CODE = process.env.REFUND_CODE || '';

// Verify the HMAC-signed lk_sess cookie (identical to admin-stats.js).
function checkAuth(req) {
  if (!SESSION_SECRET || SESSION_SECRET === 'CHANGE_ME_IN_VERCEL_ENV') return false;
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)lk_sess=([^;]+)/);
  if (!m) return false;
  const tok = decodeURIComponent(m[1]);
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return false;
  const data = tok.slice(0, dot), mac = tok.slice(dot + 1);
  const expect = createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  try {
    if (mac.length !== expect.length) return false;
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expect, 'hex'))) return false;
  } catch { return false; }
  const exp = parseInt(data, 10);
  return Number.isFinite(exp) && exp > Date.now();
}

// Branded pack shots so views show an image even when Stripe has none.
function getProductImage(productName) {
  if (!productName) return null;
  const n = productName.toLowerCase();
  const base = 'https://quartzmolle.dk';
  if (n.includes('dalarna') && n.includes('fuldkorn')) return `${base}/images/Dalarna-3Kg-fuldkorn-96x139mm-outlined_copy.jpg`;
  if (n.includes('dalarna') && n.includes('type 85')) return `${base}/images/Dalarna-3Kg-type85-96x139mm-outlined_copy.jpg`;
  if (n.includes('mariagertoba')) return `${base}/images/Mariagertoba-type70-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('ølands') && n.includes('fuldkorn')) return `${base}/images/OlandsHvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('ølands') && n.includes('type 85')) return `${base}/images/OlandsHvede-type85-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('purpurhvede')) return `${base}/images/Purpurhvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('rød hvede') && n.includes('fuldkorn')) return `${base}/images/Rod-Fuldkorn-3kg.jpg`;
  if (n.includes('rød hvede') && n.includes('type 70')) return `${base}/images/Rod-Type70-3kg.jpg`;
  if (n.includes('rød hvede') && n.includes('type 85')) return `${base}/images/Rod-Type85-3kg.jpg`;
  if (n.includes('rug')) return `${base}/images/RugGreen-3Kg-fuldkorn-96x139mm-outlined.jpg`;
  if (n.includes('spelt')) return `${base}/images/Spelt-fuldkorn-3kg-Webshop.jpg`;
  return null;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

  if (req.method === 'POST') return handleRefund(req, res, stripe);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.query.q != null && !req.query.id) return handleSearch(req, res, stripe);
  return handleDetail(req, res, stripe);
}

// ── ORDER DETAIL (GET ?id=) ──
async function handleDetail(req, res, stripe) {
  const id = String(req.query.id || '');
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(id)) {
    return res.status(400).json({ error: 'Ugyldigt ordre-id' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: [
        'line_items.data.price.product',
        'shipping_cost.shipping_rate',
        'payment_intent',
        'payment_intent.latest_charge',
      ],
    });

    const items = (session.line_items?.data || []).map(li => {
      const product = li.price?.product || {};
      const desc = product.description || '';
      const weightMatch = desc.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      const name = li.description || product.name || 'Produkt';
      const qty = li.quantity || 1;
      return {
        name,
        weightLabel: weightMatch ? weightMatch[0] : '',
        qty,
        unitPrice: ((li.amount_total || 0) / qty) / 100,
        lineTotal: (li.amount_total || 0) / 100,
        image: product.images?.[0] || getProductImage(name),
      };
    });

    const cust = session.customer_details || {};
    const ship = session.shipping_details || session.collected_information?.shipping_details || {};
    const addr = ship.address || cust.address || {};

    const pi = (session.payment_intent && typeof session.payment_intent === 'object') ? session.payment_intent : null;
    const charge = pi && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const card = charge?.payment_method_details?.card || null;

    const refunded = charge ? !!charge.refunded : false;
    const amountRefunded = charge ? (charge.amount_refunded || 0) / 100 : 0;
    const shippingName = session.shipping_cost?.shipping_rate?.display_name || '';

    return res.status(200).json({
      ok: true,
      ref: id.slice(-12).toUpperCase(),
      id,
      date: new Date((session.created || 0) * 1000).toISOString(),
      paymentStatus: session.payment_status || '',
      customer: { name: cust.name || ship.name || '', email: cust.email || '', phone: cust.phone || '' },
      address: {
        line1: addr.line1 || '', line2: addr.line2 || '',
        postalCode: addr.postal_code || '', city: addr.city || '',
        country: (addr.country || '').toUpperCase(),
      },
      items,
      shipping: { name: shippingName, amount: (session.shipping_cost?.amount_total || 0) / 100 },
      subtotal: (session.amount_subtotal || 0) / 100,
      total: (session.amount_total || 0) / 100,
      currency: (session.currency || 'dkk').toUpperCase(),
      card: card ? { brand: card.brand, last4: card.last4, exp: `${card.exp_month}/${card.exp_year}` } : null,
      refunded,
      amountRefunded,
    });
  } catch (err) {
    console.error('admin-order detail error', err.message);
    return res.status(500).json({ error: 'Kunne ikke hente ordren' });
  }
}

// ── SEARCH ALL ORDERS (GET ?q=) ──
async function handleSearch(req, res, stripe) {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(200).json({ ok: true, orders: [], query: '' });
  try {
    const nowTs = Math.floor(Date.now() / 1000);
    const since = nowTs - 400 * 86400; // ~13 months back
    const MAX_SESSIONS = 3000, MAX_MATCHES = 200;
    let scanned = 0;
    const matches = [];

    const iterator = stripe.checkout.sessions.list({ limit: 100, created: { gte: since, lte: nowTs } });
    for await (const s of iterator) {
      if (++scanned > MAX_SESSIONS) break;
      if (s.payment_status !== 'paid') continue;
      const ref = String(s.id).slice(-12).toUpperCase();
      const name = s.customer_details?.name || s.shipping_details?.name || '';
      const email = s.customer_details?.email || '';
      const addr = s.shipping_details?.address || s.customer_details?.address || {};
      const city = addr.city || '';
      const country = (addr.country || '').toUpperCase();
      if (!`${ref} ${name} ${email} ${city} ${country}`.toLowerCase().includes(q)) continue;
      matches.push({
        id: s.id, ref, customerName: name || 'Kunde', email,
        amount: (s.amount_total || 0) / 100, city: city || 'Ukendt', country,
        itemCount: null, date: new Date((s.created || 0) * 1000).toISOString(),
      });
      if (matches.length >= MAX_MATCHES) break;
    }
    matches.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json({ ok: true, orders: matches, query: q, truncated: scanned > MAX_SESSIONS });
  } catch (err) {
    console.error('admin-order search error', err.message);
    return res.status(500).json({ error: 'Søgningen mislykkedes' });
  }
}

// ── REFUND (POST { id, code, amount? }) ──
async function handleRefund(req, res, stripe) {
  // 6-digit code gate on top of the login. Fail closed if it isn't configured.
  if (!REFUND_CODE) {
    return res.status(500).json({ error: 'Refund-kode er ikke konfigureret. Sæt REFUND_CODE i Vercel.' });
  }
  const code = String((req.body && req.body.code) || '').trim();
  if (code !== REFUND_CODE) {
    return res.status(403).json({ error: 'Forkert sikkerhedskode.' });
  }

  const id = String((req.body && req.body.id) || '');
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(id)) {
    return res.status(400).json({ error: 'Ugyldigt ordre-id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Ordren er ikke betalt — der er intet at refundere.' });
    }
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!piId) return res.status(400).json({ error: 'Kunne ikke finde betalingen for ordren.' });

    // Optional partial amount (kr). Omitted → Stripe refunds the full remaining.
    const refundParams = { payment_intent: piId };
    const raw = req.body.amount;
    if (raw != null && raw !== '') {
      const amt = Number(raw);
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Ugyldigt beløb.' });
      refundParams.amount = Math.round(amt * 100);
    }

    const refund = await stripe.refunds.create(refundParams);
    return res.status(200).json({ ok: true, refundId: refund.id, status: refund.status, amount: (refund.amount || 0) / 100 });
  } catch (err) {
    console.error('admin-order refund error', err.message);
    return res.status(400).json({ error: err.message || 'Refunderingen mislykkedes.' });
  }
}
