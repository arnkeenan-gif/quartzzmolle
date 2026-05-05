// api/checkout.js — Vercel Serverless Function
// Creates a Stripe-hosted Checkout Session for the cart and returns the redirect URL.

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

    // Use known production URL since req.headers.origin may be missing on POST from cross-origin
    const origin = 'https://quartzzmolle-dusky.vercel.app';

    const line_items = items.map(it => {
      const product_data = {
        name: it.productType ? `${it.productName} – ${it.productType}` : it.productName,
        description: `${it.weightLabel} · Malet på stenkværn i Danmark · Certificeret Økologisk`,
      };
      if (it.image) {
        let imgUrl;
        if (it.image.startsWith('http')) {
          imgUrl = it.image;
        } else {
          const path = it.image.replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
          imgUrl = `${origin}/${path}`;
        }
        console.log('Stripe product image URL:', imgUrl);
        product_data.images = [imgUrl];
      } else {
        console.log('No image for item:', it.productName);
      }
      return {
        price_data: {
          currency: 'dkk',
          product_data,
          unit_amount: Math.round(it.price * 100),
        },
        quantity: it.qty,
      };
    });

    // Calculate total cart weight (kg) by parsing each item's weightLabel
    function parseWeightKg(label) {
      if (!label) return 0;
      const m = String(label).match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      if (!m) return 0;
      return parseFloat(m[1].replace(',', '.')) || 0;
    }
    const totalWeightKg = items.reduce((sum, it) => {
      return sum + (parseWeightKg(it.weightLabel) * (it.qty || 1));
    }, 0);
    console.log('Total cart weight:', totalWeightKg, 'kg');

    // GLS shipping limits
    const PAKKESHOP_LIMIT = 19.9;
    const PRIVAT_LIMIT = 24.9;

    if (totalWeightKg > PRIVAT_LIMIT) {
      return res.status(400).json({
        error: `Din ordre vejer ${totalWeightKg.toFixed(1)} kg. GLS kan kun sende op til 25 kg. Del venligst din ordre op i flere bestillinger eller kontakt os på hello@quartzmolle.dk.`,
      });
    }

    // GLS ShopDelivery prices by weight (øre)
    function getPakkeshopPrice(kg) {
      if (kg <= 5)  return 4600;
      if (kg <= 10) return 5500;
      if (kg <= 15) return 6600;
      return 8100; // 15-20 kg
    }

    // GLS PrivateDelivery prices by weight (øre)
    function getPrivatPrice(kg) {
      if (kg <= 5)  return 6300;
      if (kg <= 10) return 7500;
      if (kg <= 15) return 9000;
      if (kg <= 20) return 10500;
      return 13900; // 20-25 kg
    }

    // Build shipping options based on weight
    const shippingOptions = [];
    if (totalWeightKg <= PAKKESHOP_LIMIT) {
      shippingOptions.push({
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: getPakkeshopPrice(totalWeightKg), currency: 'dkk' },
          display_name: 'GLS Pakkeshop (max 20 kg)',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 1 },
            maximum: { unit: 'business_day', value: 3 },
          },
        },
      });
    }
    shippingOptions.push({
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: getPrivatPrice(totalWeightKg), currency: 'dkk' },
        display_name: 'GLS Privatadresse (max 25 kg)',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 1 },
          maximum: { unit: 'business_day', value: 3 },
        },
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'mobilepay'],
      line_items,
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/shop`,
      shipping_address_collection: {
        allowed_countries: ['DK', 'SE', 'NO', 'DE', 'NL', 'GB'],
      },
      phone_number_collection: { enabled: true },
      shipping_options: shippingOptions,
      locale: 'da',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
