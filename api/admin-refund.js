// api/admin-refund.js — Refunds a single order through Stripe, from the admin panel.
//
// Auth: shares the /locker session cookie (lk_sess) — same passcode as
//       /locker, /fulfill and the admin dashboard.
// Method: POST  Body: { id: "cs_live_..." }  (the Stripe Checkout Session id)
//
// Creates a full refund on the order's PaymentIntent. Stripe is idempotent about
// this in practice: a session that is already refunded returns a clear error,
// which we pass back to the panel.

import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || '';

// Verify the HMAC-signed lk_sess cookie (identical to admin-stats.js / admin-order.js).
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

// Extra safety gate on top of the login: a 6-digit code must be entered for
// every refund. The code lives ONLY in the Vercel env var REFUND_CODE — never
// in the source. If it isn't configured, refunds are refused (fail closed).
const REFUND_CODE = process.env.REFUND_CODE || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  // Verify the refund security code before doing anything else. Fail closed if
  // the code hasn't been configured in Vercel so a missing env var can't leave
  // refunds wide open.
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
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    // Find the PaymentIntent behind this checkout session.
    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Ordren er ikke betalt — der er intet at refundere.' });
    }
    const piId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!piId) {
      return res.status(400).json({ error: 'Kunne ikke finde betalingen for ordren.' });
    }

    // Optional partial amount (in kroner). If omitted, Stripe refunds the full
    // remaining amount. If given, it must be a positive number; Stripe rejects
    // anything above the remaining refundable balance and we pass that error on.
    const refundParams = { payment_intent: piId };
    const raw = req.body.amount;
    if (raw != null && raw !== '') {
      const amt = Number(raw);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Ugyldigt beløb.' });
      }
      refundParams.amount = Math.round(amt * 100); // kr → øre
    }

    const refund = await stripe.refunds.create(refundParams);

    return res.status(200).json({
      ok: true,
      refundId: refund.id,
      status: refund.status,           // 'succeeded' | 'pending' | 'failed'
      amount: (refund.amount || 0) / 100,
    });
  } catch (err) {
    // Stripe gives a human-readable message, e.g. "Charge has already been refunded".
    console.error('admin-refund error', err.message);
    return res.status(400).json({ error: err.message || 'Refunderingen mislykkedes.' });
  }
}
