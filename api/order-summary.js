// api/order-summary.js — Returns order details by Stripe session_id
// Called from success.html to display the order on the confirmation page

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const sessionId = req.query.session_id;
  // Stripe Checkout session ids look like cs_live_/cs_test_ + base62 — validate
  // the shape to reject junk/probing before hitting Stripe.
  if (!sessionId || !/^cs_[A-Za-z0-9_]{10,}$/.test(String(sessionId))) {
    return res.status(400).json({ error: 'Missing or invalid session_id' });
  }
  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product', 'shipping_cost.shipping_rate'],
    });

    const items = (session.line_items?.data || []).map(li => {
      const img = li.price?.product?.images?.[0] || null;
      const desc = li.price?.product?.description || '';
      const weightMatch = desc.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      const weightLabel = weightMatch ? weightMatch[0] : '';
      console.log('Order summary item:', li.description, '| weight:', weightLabel, '| picked:', img);
      return {
        name: li.description || li.price?.product?.name || 'Produkt',
        weightLabel: weightLabel,
        qty: li.quantity || 1,
        price: ((li.amount_total || 0) / (li.quantity || 1)) / 100,
        lineTotal: (li.amount_total || 0) / 100,
        image: img,
      };
    });

    return res.status(200).json({
      ok: true,
      orderRef: String(sessionId).slice(-12).toUpperCase(),
      items,
      total: (session.amount_total || 0) / 100,
      shipping: session.shipping_cost?.shipping_rate?.display_name || '',
      shippingAmount: (session.shipping_cost?.amount_total || 0) / 100,
    });
  } catch (err) {
    console.error('order-summary error', err.message);
    return res.status(500).json({ error: 'Kunne ikke hente ordren' });
  }
}
