// api/admin-stats.js — Returns dashboard data from Stripe + visitor stats from Vercel KV
//
// Auth: shares the /locker session cookie (lk_sess) — log in with the same
//       passcode used on /locker and /fulfill.
// Query: ?days=7 (default 7, options: 7/30/90)

import { createHmac, timingSafeEqual } from 'crypto';
import { kv } from '@vercel/kv';

// Map product names (from Stripe line item descriptions) to image paths in our repo
function getProductImage(productName) {
  if (!productName) return null;
  const n = productName.toLowerCase();
  const baseUrl = 'https://quartzmolle.dk';
  // Match by keywords in product name
  if (n.includes('dalarna') && n.includes('fuldkorn')) return `${baseUrl}/images/Dalarna-3Kg-fuldkorn-96x139mm-outlined_copy.jpg`;
  if (n.includes('dalarna') && n.includes('type 85')) return `${baseUrl}/images/Dalarna-3Kg-type85-96x139mm-outlined_copy.jpg`;
  if (n.includes('mariagertoba')) return `${baseUrl}/images/Mariagertoba-type70-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('ølands') && n.includes('fuldkorn')) return `${baseUrl}/images/OlandsHvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('ølands') && n.includes('type 85')) return `${baseUrl}/images/OlandsHvede-type85-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('purpurhvede')) return `${baseUrl}/images/Purpurhvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg`;
  if (n.includes('rød hvede') && n.includes('fuldkorn')) return `${baseUrl}/images/Rod-Fuldkorn-3kg.jpg`;
  if (n.includes('rød hvede') && n.includes('type 70')) return `${baseUrl}/images/Rod-Type70-3kg.jpg`;
  if (n.includes('rød hvede') && n.includes('type 85')) return `${baseUrl}/images/Rod-Type85-3kg.jpg`;
  if (n.includes('rug')) return `${baseUrl}/images/RugGreen-3Kg-fuldkorn-96x139mm-outlined.jpg`;
  if (n.includes('spelt')) return `${baseUrl}/images/Spelt-fuldkorn-3kg-Webshop.jpg`;
  return null;
}

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';

// Verify the HMAC-signed lk_sess cookie set by /api/locker (action=login) —
// the same login used by /locker and /fulfill.
function checkAuth(req) {
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

// Parse a YYYY-MM-DD string into a UNIX timestamp (seconds) at the start or end
// of that day. Returns null if the string isn't a valid date.
function dayBoundary(str, endOfDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const t = Date.parse(str + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 1000);
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const nowTs = Math.floor(Date.now() / 1000);

  // Time window: either an explicit ?from=YYYY-MM-DD[&to=YYYY-MM-DD] range
  // (lets staff pick a specific day, e.g. 5th of May), or ?days=N back from now.
  const fromStr = (req.query.from || '').toString().trim();
  const toStr = (req.query.to || '').toString().trim();
  let since, until, rangeLabel;

  const fromTs = dayBoundary(fromStr, false);
  if (fromTs !== null) {
    since = fromTs;
    const toTs = dayBoundary(toStr, true);
    until = toTs !== null ? toTs : dayBoundary(fromStr, true); // single day if no "to"
    if (until > nowTs) until = nowTs;
    rangeLabel = toStr && toStr !== fromStr ? `${fromStr} – ${toStr}` : fromStr;
  } else {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);
    since = nowTs - days * 86400;
    until = nowTs;
    rangeLabel = `${days} dage`;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = Math.floor(todayStart.getTime() / 1000);

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    // Aggregate stats
    let totalRevenue = 0;
    let revenueToday = 0;
    let ordersToday = 0;
    let totalOrders = 0;
    const locationCounts = {};
    const paid = []; // every paid session in the window (for orders + product fetch)

    // Paginate through EVERY session in the window (not just the first 100) so
    // the revenue/order totals are fully accurate. Money comes from amount_total,
    // which is always present — no extra API calls needed for the headline numbers.
    // Safety cap so a huge window can never run the function past its timeout.
    const MAX_SESSIONS = 3000;
    let scanned = 0;

    const iterator = stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: since, lte: until },
    });

    for await (const s of iterator) {
      if (++scanned > MAX_SESSIONS) break;
      if (s.payment_status !== 'paid') continue;

      totalOrders++;
      const amountKr = (s.amount_total || 0) / 100;
      totalRevenue += amountKr;

      if (s.created >= todayTs) {
        revenueToday += amountKr;
        ordersToday++;
      }

      // Extract location from shipping/billing
      const addr = s.shipping_details?.address || s.collected_information?.shipping_details?.address || s.customer_details?.address || {};
      const country = (addr.country || 'DK').toUpperCase();
      const city = addr.city || 'Ukendt';
      const locKey = `${city}, ${country}`;
      locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;

      paid.push({
        id: s.id,
        ref: String(s.id).slice(-12).toUpperCase(),
        customerName: s.customer_details?.name || s.shipping_details?.name || 'Kunde',
        email: s.customer_details?.email || '',
        amount: amountKr,
        city: city,
        country: country,
        itemCount: null,
        created: s.created || 0,
        date: new Date((s.created || 0) * 1000).toISOString(),
      });
    }

    // Newest first
    paid.sort((a, b) => b.created - a.created);

    // Product breakdown + per-order item counts need line items (one call each).
    // Fetch them for the most recent orders only, in small concurrent batches, so
    // we stay well within the function timeout. For a shop this size that usually
    // covers the whole window; if not, the headline totals above are still exact.
    const productCounts = {};
    const LINE_ITEM_LIMIT = 150;
    const toFetch = paid.slice(0, LINE_ITEM_LIMIT);
    const BATCH = 8;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      await Promise.all(batch.map(async (o) => {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(o.id, { limit: 50 });
          let itemCount = 0;
          for (const li of lineItems.data) {
            const name = li.description || 'Produkt';
            const qty = li.quantity || 1;
            if (!productCounts[name]) productCounts[name] = { qty: 0, image: getProductImage(name) };
            productCounts[name].qty += qty;
            itemCount += qty;
          }
          o.itemCount = itemCount;
        } catch (e) { /* leave itemCount null */ }
      }));
    }

    const recentOrders = paid.map(({ id, created, ...rest }) => rest);

    // Sort + top N
    const topProducts = Object.entries(productCounts)
      .map(([name, data]) => ({ name, qty: data.qty, image: data.image }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    const topLocations = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    recentOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Unique visitors across the selected period, for the period conversion rate.
    // Daily sets are keyed visitors:YYYY-MM-DD (UTC). We sum each day in range;
    // days that have expired simply count as 0.
    let periodVisitors = 0;
    try {
      const days = [];
      const startDay = new Date(since * 1000); startDay.setUTCHours(0, 0, 0, 0);
      const endDay = new Date(until * 1000); endDay.setUTCHours(0, 0, 0, 0);
      for (let d = new Date(startDay); d <= endDay && days.length <= 400; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(`visitors:${d.toISOString().slice(0, 10)}`);
      }
      const BATCH = 20;
      for (let i = 0; i < days.length; i += BATCH) {
        const counts = await Promise.all(days.slice(i, i + BATCH).map(k => kv.scard(k).catch(() => 0)));
        periodVisitors += counts.reduce((a, b) => a + (b || 0), 0);
      }
    } catch (e) { /* KV unavailable → leave 0 */ }

    return res.status(200).json({
      totalOrders,
      totalRevenue,
      ordersToday,
      revenueToday,
      periodVisitors,
      rangeLabel,
      truncated: scanned > MAX_SESSIONS,
      orders: recentOrders.slice(0, 300), // enough to search across; UI filters by name/number
      topProducts,
      locations: topLocations,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}
