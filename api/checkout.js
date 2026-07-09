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

    // ── Destination country (chosen in the cart). DENMARK keeps its exact old
    //    prices; every other country is charged the correct GLS rate. ──
    const country = String((req.body && req.body.country) || 'DK').toUpperCase();

    // GLS DENMARK prices by weight (øre) — UNCHANGED.
    const PAKKESHOP_LIMIT = 19.9;
    const PRIVAT_LIMIT = 24.9;
    function getPakkeshopPrice(kg) {
      if (kg <= 5)  return 4600;
      if (kg <= 10) return 5500;
      if (kg <= 15) return 6600;
      return 8100; // 15-20 kg
    }
    function getPrivatPrice(kg) {
      if (kg <= 5)  return 6300;
      if (kg <= 10) return 7500;
      if (kg <= 15) return 9000;
      if (kg <= 20) return 10500;
      return 13900; // 20-25 kg
    }

    // INTERNATIONAL GLS prices (kr → øre) per country, from GLS agreement 31881.
    // base[] = EuroBusinessParcel / ShopDelivery price by weight band:
    //   [0-1, >1-5, >5-10, >10-15, >15-20, >20-25, >25-30] kg.
    // Pakkeshop (ShopDelivery) uses base (max 20 kg, only where shop:true).
    // Privatadresse (PrivateDelivery) = base + privSur (only where home:true).
    const INTL_SHIPPING = {
      BE: { base: [7000, 8800, 11200, 14700, 17550, 23250, 27900], privSur: 2000, home: true, shop: true },
      BG: { base: [15000, 19500, 22400, 27850, 31600, 42950, 51500], privSur: 2000, home: true, shop: false },
      CY: { base: [30300, 39300, 54900, 80100, 108600, 143100, 162800], privSur: 0, home: false, shop: false },
      EE: { base: [14500, 18850, 21650, 26900, 30550, 41500, 49800], privSur: 0, home: false, shop: false },
      FI: { base: [15000, 19600, 22950, 27300, 32750, 43800, 52600], privSur: 0, home: true, shop: true },
      FR: { base: [7000, 10250, 11750, 14050, 15400, 19550, 23450], privSur: 2000, home: true, shop: true },
      GR: { base: [30300, 39300, 54900, 72300, 88700, 125800, 146200], privSur: 2000, home: true, shop: false },
      NL: { base: [8000, 10100, 12750, 16800, 20050, 26550, 31850], privSur: 2000, home: true, shop: true },
      IE: { base: [15000, 19600, 22950, 27300, 32750, 43800, 52600], privSur: 2000, home: true, shop: true },
      IT: { base: [15000, 19500, 22400, 27850, 31600, 42950, 51500], privSur: 2000, home: true, shop: true },
      HR: { base: [15000, 19450, 27200, 39650, 53750, 70850, 85000], privSur: 2000, home: true, shop: false },
      LV: { base: [14000, 18200, 20900, 26000, 29500, 40050, 48100], privSur: 0, home: false, shop: false },
      LT: { base: [14000, 18200, 20900, 26000, 29500, 40050, 48100], privSur: 0, home: false, shop: false },
      LU: { base: [11000, 13850, 17550, 23100, 27550, 36500, 43800], privSur: 2000, home: true, shop: true },
      MT: { base: [30300, 39300, 54900, 80100, 108600, 143100, 162800], privSur: 0, home: false, shop: false },
      NO: { base: [12000, 15150, 19150, 25200, 30050, 39850, 47800], privSur: 0, home: true, shop: false },
      PL: { base: [7000, 8800, 11200, 14700, 17550, 23250, 27900], privSur: 2000, home: true, shop: true },
      PT: { base: [15000, 19600, 22950, 27300, 32750, 43800, 52600], privSur: 2000, home: true, shop: true },
      RO: { base: [15000, 19500, 22400, 27850, 31600, 42950, 51500], privSur: 2000, home: true, shop: false },
      CH: { base: [14000, 17700, 21850, 28400, 34150, 44650, 53600], privSur: 2000, home: true, shop: false },
      SK: { base: [14000, 17650, 22350, 29400, 35050, 46450, 55750], privSur: 2000, home: true, shop: true },
      SI: { base: [14000, 18200, 20900, 26000, 29500, 40050, 48100], privSur: 2000, home: true, shop: true },
      ES: { base: [14500, 18950, 22200, 26400, 31650, 42350, 50850], privSur: 2000, home: true, shop: true },
      GB: { base: [13000, 19050, 21800, 26150, 28600, 36300, 43600], privSur: 2000, home: true, shop: false },
      SE: { base: [10000, 12650, 15600, 20300, 24400, 31900, 38300], privSur: 0, home: false, shop: true },
      CZ: { base: [14000, 17650, 22350, 29400, 35050, 46450, 55750], privSur: 2000, home: true, shop: true },
      DE: { base: [7000, 8800, 11200, 14700, 17550, 23250, 27900], privSur: 2000, home: true, shop: true },
      HU: { base: [14000, 18200, 20900, 26000, 29500, 40050, 48100], privSur: 2000, home: true, shop: true },
      AT: { base: [11000, 13900, 17200, 22300, 26800, 35100, 42100], privSur: 2000, home: true, shop: true },
    };

    const WEIGHT_BANDS = [1, 5, 10, 15, 20, 25, 30]; // upper bounds (kg)
    function bandIndex(kg) {
      for (let i = 0; i < WEIGHT_BANDS.length; i++) if (kg <= WEIGHT_BANDS[i]) return i;
      return -1;
    }

    const est = { minimum: { unit: 'business_day', value: 1 }, maximum: { unit: 'business_day', value: 3 } };
    const rate = (amount, name) => ({
      shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount, currency: 'dkk' }, display_name: name, delivery_estimate: est },
    });

    // Build the shipping options for the chosen country. The display names keep
    // "Pakkeshop" / "Privatadresse" / "Click & Collect" so the webhook classifies
    // them exactly as before. Click & Collect is always available.
    const shippingOptions = [];
    if (country === 'DK') {
      if (totalWeightKg <= PAKKESHOP_LIMIT) shippingOptions.push(rate(getPakkeshopPrice(totalWeightKg), 'GLS Pakkeshop (max 20 kg)'));
      if (totalWeightKg <= PRIVAT_LIMIT)    shippingOptions.push(rate(getPrivatPrice(totalWeightKg), 'GLS Privatadresse (max 25 kg)'));
    } else if (INTL_SHIPPING[country]) {
      const c = INTL_SHIPPING[country];
      const idx = bandIndex(totalWeightKg);
      // Pakkeshop (ShopDelivery) — where available, max 20 kg (band index 0-4)
      if (c.shop && idx >= 0 && idx <= 4) shippingOptions.push(rate(c.base[idx], 'GLS Pakkeshop (max 20 kg)'));
      // Privatadresse (PrivateDelivery) — where available, up to 30 kg
      if (c.home && idx >= 0)              shippingOptions.push(rate(c.base[idx] + c.privSur, 'GLS Privatadresse'));
    }

    // Click & Collect — gratis afhentning på møllen. The display_name must stay
    // recognisable to the webhook (it matches "afhent"/"collect") and must NOT
    // contain "pakkeshop"/"privat", so it is never misread as a GLS delivery.
    shippingOptions.push(rate(0, 'Click & Collect – Afhentning på møllen (Suså Landevej 101)'));

    // Lock the Stripe address country to the one priced above so the customer
    // can't switch to a different (mis-priced) country on the payment page.
    const allowedCountry = (country === 'DK' || INTL_SHIPPING[country]) ? country : 'DK';

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
        allowed_countries: [allowedCountry],
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
