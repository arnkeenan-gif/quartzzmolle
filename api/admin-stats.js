// api/admin-stats.js — Returns dashboard data from Stripe + visitor stats from Vercel KV
//
// Auth: shares the /locker session cookie (lk_sess) — log in with the same
//       passcode used on /locker and /fulfill.
// Query: ?days=7 (default 7, options: 7/30/90)

import { createHmac, timingSafeEqual } from 'crypto';

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

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
  const since = Math.floor(Date.now() / 1000) - (days * 86400);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = Math.floor(todayStart.getTime() / 1000);

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    // Fetch checkout sessions in the time window
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: since },
    });

    const paidSessions = sessions.data.filter(s => s.payment_status === 'paid');

    // Aggregate stats
    let totalRevenue = 0;
    let revenueToday = 0;
    let ordersToday = 0;
    const productCounts = {};
    const locationCounts = {};
    const recentOrders = [];

    for (const s of paidSessions) {
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

      // Get line items for product breakdown + item count
      let itemCount = 0;
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(s.id, { limit: 20 });
        for (const li of lineItems.data) {
          const name = li.description || 'Produkt';
          const qty = li.quantity || 1;
          const img = getProductImage(name);
          if (!productCounts[name]) {
            productCounts[name] = { qty: 0, image: img };
          }
          productCounts[name].qty += qty;
          itemCount += qty;
        }
      } catch (e) { /* skip */ }

      recentOrders.push({
        ref: String(s.id).slice(-12).toUpperCase(),
        customerName: s.customer_details?.name || s.shipping_details?.name || 'Kunde',
        amount: amountKr,
        city: city,
        country: country,
        itemCount: itemCount,
        date: new Date((s.created || 0) * 1000).toISOString(),
      });
    }

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

    return res.status(200).json({
      totalOrders: paidSessions.length,
      totalRevenue,
      ordersToday,
      revenueToday,
      orders: recentOrders.slice(0, 20),
      topProducts,
      locations: topLocations,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}
