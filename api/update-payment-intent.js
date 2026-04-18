// api/update-payment-intent.js — Updates metadata on an existing PaymentIntent
// Called right before confirming payment, so the latest delivery choice + pakkeshop
// selection gets saved to the PaymentIntent metadata.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentIntentId, delivery, pakkeshop, customer, items } = req.body || {};

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'Missing paymentIntentId' });
  }

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const itemsSummary = Array.isArray(items) ? items.map(it =>
      `${it.productName}|${it.weightLabel}|${it.qty}|${it.price}`
    ).join(';').slice(0, 490) : '';

    const metadata = {
      delivery_method: delivery || 'gls_privat',
      customer_email: customer?.email || '',
      customer_name: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim(),
      customer_phone: customer?.phone || '',
      customer_address1: String(customer?.address || '').slice(0, 100),
      customer_zipcode: String(customer?.zip || '').slice(0, 20),
      customer_city: String(customer?.city || '').slice(0, 50),
      customer_country: String(customer?.country || 'DK').slice(0, 2),
      items_summary: itemsSummary,
    };
    if (pakkeshop && pakkeshop.id) {
      metadata.pakkeshop_id = String(pakkeshop.id).slice(0, 50);
      metadata.pakkeshop_name = String(pakkeshop.name || '').slice(0, 100);
      metadata.pakkeshop_address = String(pakkeshop.address || '').slice(0, 100);
      metadata.pakkeshop_zipcode = String(pakkeshop.zipcode || '').slice(0, 20);
      metadata.pakkeshop_city = String(pakkeshop.city || '').slice(0, 50);
    }

    await stripe.paymentIntents.update(paymentIntentId, { metadata });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Stripe update error:', err);
    return res.status(500).json({ error: err.message });
  }
}
