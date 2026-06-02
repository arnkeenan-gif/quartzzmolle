// api/admin-stats.js — Returns dashboard data from Stripe + visitor stats from Vercel KV
//
// Auth: HTTP Basic Auth (username:password)
// Query: ?days=7 (default 7, options: 7/30/90)

const ADMIN_USER = 'fintankeenan';
const ADMIN_PASS = 'Laragh';

function checkAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    const [u, p] = decoded.split(':');
    return u === ADMIN_USER && p === ADMIN_PASS;
  } catch { return false; }
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
          productCounts[name] = (productCounts[name] || 0) + qty;
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
      .map(([name, qty]) => ({ name, qty }))
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
