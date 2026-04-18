// api/create-payment-intent.js — Vercel Serverless Function
// Creates a Stripe PaymentIntent for the custom Stripe Elements checkout.
// Embeds all order info in metadata so the webhook can create Shipmondo orders.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, delivery, pakkeshop, customer, amount } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customer || !customer.email) {
    return res.status(400).json({ error: 'Missing customer details' });
  }
  if (!amount || amount < 100) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    // Compact items summary — Stripe metadata has a 500-char limit per field.
    const itemsSummary = items.map(it =>
      `${it.productName}|${it.weightLabel}|${it.qty}|${it.price}`
    ).join(';').slice(0, 490);

    const metadata = {
      delivery_method: delivery || 'gls_privat',
      customer_email: customer.email,
      customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
      customer_phone: customer.phone,
      items_summary: itemsSummary,
    };
    if (pakkeshop && pakkeshop.id) {
      metadata.pakkeshop_id = String(pakkeshop.id).slice(0, 50);
      metadata.pakkeshop_name = String(pakkeshop.name || '').slice(0, 100);
      metadata.pakkeshop_address = String(pakkeshop.address || '').slice(0, 100);
      metadata.pakkeshop_zipcode = String(pakkeshop.zipcode || '').slice(0, 20);
      metadata.pakkeshop_city = String(pakkeshop.city || '').slice(0, 50);
    }

    // Put full customer address in metadata (not in `shipping` field — that conflicts with Link).
    metadata.customer_address1 = String(customer.address || '').slice(0, 100);
    metadata.customer_zipcode = String(customer.zip || '').slice(0, 20);
    metadata.customer_city = String(customer.city || '').slice(0, 50);
    metadata.customer_country = String(customer.country || 'DK').slice(0, 2);

    const intent = await stripe.paymentIntents.create({
      amount, // in øre
      currency: 'dkk',
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      metadata,
    });

    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err);
    return res.status(500).json({ error: err.message });
  }
}
