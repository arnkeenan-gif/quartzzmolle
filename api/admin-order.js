// api/admin-order.js — Full detail for a single order, for the admin panel.
//
// Auth: shares the /locker session cookie (lk_sess) — same passcode as
//       /locker, /fulfill and the admin dashboard.
// Query: ?id=cs_live_...  (the Stripe Checkout Session id from admin-stats)
//
// Returns everything the admin needs on one order: line items (with images),
// customer name/email/phone, full shipping address, delivery method + cost,
// card brand/last4, payment status, the buyer's IP and, when Stripe has it,
// the approximate IP location.

import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || '';

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

// Reuse the same product-image map style as admin-stats so the detail view
// shows the branded pack shots even when Stripe has no product image.
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

  const id = String(req.query.id || '');
  // Stripe Checkout session ids look like cs_live_/cs_test_ + base62.
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(id)) {
    return res.status(400).json({ error: 'Ugyldigt ordre-id' });
  }

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: [
        'line_items.data.price.product',
        'shipping_cost.shipping_rate',
        'payment_intent',
        'payment_intent.latest_charge',
      ],
    });

    // ── Line items ──
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

    // ── Customer + address ──
    const cust = session.customer_details || {};
    const ship = session.shipping_details
      || session.collected_information?.shipping_details
      || {};
    const addr = ship.address || cust.address || {};

    // ── Card + IP (from the underlying PaymentIntent / Charge) ──
    const pi = (session.payment_intent && typeof session.payment_intent === 'object')
      ? session.payment_intent : null;
    const charge = pi && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const card = charge?.payment_method_details?.card || null;

    // Refund state. `refunded` means FULLY refunded (Stripe sets charge.refunded
    // only then); amountRefunded lets the panel show partial refunds and offer to
    // refund the remaining balance.
    const refunded = charge ? !!charge.refunded : false;
    const amountRefunded = charge ? (charge.amount_refunded || 0) / 100 : 0;

    // Delivery method label from the chosen shipping rate.
    const shippingName = session.shipping_cost?.shipping_rate?.display_name || '';

    return res.status(200).json({
      ok: true,
      ref: id.slice(-12).toUpperCase(),
      id,
      date: new Date((session.created || 0) * 1000).toISOString(),
      paymentStatus: session.payment_status || '',
      customer: {
        name: cust.name || ship.name || '',
        email: cust.email || '',
        phone: cust.phone || '',
      },
      address: {
        line1: addr.line1 || '',
        line2: addr.line2 || '',
        postalCode: addr.postal_code || '',
        city: addr.city || '',
        country: (addr.country || '').toUpperCase(),
      },
      items,
      shipping: {
        name: shippingName,
        amount: (session.shipping_cost?.amount_total || 0) / 100,
      },
      subtotal: (session.amount_subtotal || 0) / 100,
      total: (session.amount_total || 0) / 100,
      currency: (session.currency || 'dkk').toUpperCase(),
      card: card ? { brand: card.brand, last4: card.last4, exp: `${card.exp_month}/${card.exp_year}` } : null,
      refunded,
      amountRefunded,
    });
  } catch (err) {
    console.error('admin-order error', err.message);
    return res.status(500).json({ error: 'Kunne ikke hente ordren' });
  }
}
