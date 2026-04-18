// api/create-payment-intent.js — Vercel Serverless Function
// Creates a Stripe PaymentIntent for the custom Stripe Elements checkout.
// Embeds all order info in metadata so the webhook can create Shipmondo orders.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, delivery, customer, amount } = req.body || {};

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

    const intent = await stripe.paymentIntents.create({
      amount, // in øre
      currency: 'dkk',
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      shipping: {
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone,
        address: {
          line1: customer.address,
          postal_code: customer.zip,
          city: customer.city,
          country: customer.country || 'DK',
        },
      },
      metadata: {
        delivery_method: delivery || 'gls_privat',
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        customer_phone: customer.phone,
        items_summary: itemsSummary,
      },
    });

    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err);
    return res.status(500).json({ error: err.message });
  }
}
