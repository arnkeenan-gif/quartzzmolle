// api/checkout.js — Vercel Serverless Function
// Creates a Stripe-hosted Checkout Session for the cart and returns the redirect URL.
//
// SECURITY: prices, weights and quantities are validated server-side against the
// authoritative catalog (api/_catalog.js, merged with Supabase). Client-supplied
// prices are NEVER trusted — a manipulated price/weight is rejected.

import { CATALOG, buildPriceMap, weightKgFromLabel } from './_catalog.js';

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

    // ── SERVER-SIDE VALIDATION: authoritative price + weight per line ──
    const priceMap = buildPriceMap();
    const validated = [];
    for (const it of items) {
      const id = String(it.productId || '');
      const label = String(it.weightLabel || '');
      const key = `${id}|${label}`;
      const price = priceMap[key];
      if (price == null) {
        return res.status(400).json({ error: 'Ugyldig vare i kurven' });
      }
      let qty = parseInt(it.qty, 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      if (qty > 99) qty = 99; // sane cap
      validated.push({
        id, label, qty,
        price,                              // authoritative kr price
        kg: weightKgFromLabel(label),       // authoritative weight
        productName: String(it.productName || ''),
        productType: String(it.productType || ''),
        image: typeof it.image === 'string' ? it.image : '',
      });
    }

    const line_items = validated.map(it => {
      // Build name: "Rød hvede – Type 70" so it shows in Stripe AND Shipmondo
      const typeStr = it.productType ? ` – ${it.productType}` : '';
      const product_data = {
        name: `${it.productName}${typeStr}`,
        description: `${it.label} · Malet på stenkværn i Danmark · Certificeret Økologisk`,
      };
      if (it.image) {
        let imgUrl;
        if (it.image.startsWith('http')) {
          imgUrl = it.image;
        } else {
          const path = it.image.replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
          imgUrl = `${origin}/${path}`;
        }
        product_data.images = [imgUrl];
      }
      return {
        price_data: {
          currency: 'dkk',
          product_data,
          unit_amount: Math.round(it.price * 100), // authoritative price
        },
        quantity: it.qty,
      };
    });

    // Total cart weight (kg) from the AUTHORITATIVE per-line weight
    const totalWeightKg = validated.reduce((sum, it) => sum + it.kg * it.qty, 0);

    // GLS shipping limits. Orders heavier than GLS can carry are NOT blocked
    // anymore — they can still be completed with Click & Collect (pickup), which
    // has no carrier weight limit. See shippingOptions below.
    const PAKKESHOP_LIMIT = 19.9;
    const PRIVAT_LIMIT = 24.9;

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

    // Build shipping options based on weight.
    // GLS options are only offered within carrier limits; Click & Collect is always
    // available — and is the ONLY option for orders heavier than GLS can carry.
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
    if (totalWeightKg <= PRIVAT_LIMIT) {
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
    }

    // Click & Collect — gratis afhentning på møllen. The display_name must stay
    // recognisable to the webhook (it matches "afhent"/"collect") and must NOT
    // contain "pakkeshop"/"privat", so it is never misread as a GLS delivery.
    shippingOptions.push({
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 0, currency: 'dkk' },
        display_name: 'Click & Collect – Afhentning på møllen (Suså Landevej 101)',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 1 },
          maximum: { unit: 'business_day', value: 3 },
        },
      },
    });

    // Embed items in metadata (format: name|type|weight|qty|price) so the webhook
    // can always recover productType even if the Stripe product name parsing fails.
    const itemsSummary = validated.map(it =>
      `${it.productName}|${it.productType}|${it.label}|${it.qty}|${it.price}`
    ).join(';').slice(0, 490);

    // Record the buyer's IP so it shows on the order in the admin panel.
    // Behind Vercel the real client IP is the first entry in x-forwarded-for.
    const clientIp = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0].trim() || req.socket?.remoteAddress || '';

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
      metadata: { items_summary: itemsSummary, client_ip: clientIp },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout session error:', err);
    return res.status(500).json({ error: 'Kunne ikke oprette betaling. Prøv igen.' });
  }
}
