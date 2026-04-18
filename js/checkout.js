// api/checkout.js — Vercel Serverless Function
// Creates a Stripe Checkout Session from a cart of items
// Set STRIPE_SECRET_KEY in Vercel Environment Variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const line_items = items.map(it => ({
      price_data: {
        currency: 'dkk',
        product_data: {
          name: `${it.productName} – ${it.productType}`,
          description: `${it.weightLabel} · Malet på stenkværn i Danmark · Certificeret Økologisk`,
        },
        unit_amount: Math.round(it.price * 100),
      },
      quantity: it.qty || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/shop.html`,
      shipping_address_collection: {
        allowed_countries: ['DK', 'SE', 'NO', 'DE', 'NL', 'GB'],
      },
      locale: 'da',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
