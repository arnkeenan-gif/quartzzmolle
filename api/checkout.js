// api/checkout.js — Vercel Serverless Function
// Creates a Stripe Checkout Session
// Set STRIPE_SECRET_KEY in Vercel Environment Variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, productName, productType, weightLabel, price } = req.body;

  if (!productId || !price) {
    return res.status(400).json({ error: 'Missing product info' });
  }

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'dkk',
          product_data: {
            name: `${productName} – ${productType}`,
            description: `${weightLabel} · Malet på stenkværn i Danmark · Certificeret Økologisk`,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/product.html?id=${productId}`,
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
