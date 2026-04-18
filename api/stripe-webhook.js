// api/stripe-webhook.js — Vercel Serverless Function
//
// Listens for Stripe's `checkout.session.completed` event and creates a draft
// shipment in Shipmondo with the customer's address, items, and chosen carrier.
//
// Required Vercel environment variables:
//   STRIPE_SECRET_KEY        — sk_live_...
//   STRIPE_WEBHOOK_SECRET    — whsec_... from your Stripe webhook endpoint
//   SHIPMONDO_USER           — your Shipmondo API user (e.g. API-123456)
//   SHIPMONDO_KEY            — your Shipmondo API key
//   SHIPMENT_TEMPLATES       — JSON: {"gls_pakkeshop":ID,"gls_privat":ID}

// Tell Vercel NOT to parse the body — we need the raw buffer to verify Stripe's signature.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read the raw request body as a Buffer (needed for stripe.webhooks.constructEvent).
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Parse a weight label like "3 kg" or "12,5 kg" into grams.
function parseWeightGrams(label) {
  if (!label) return 3000;
  // Accept comma or dot as decimal separator, strip the "kg"
  const cleaned = String(label).toLowerCase().replace('kg', '').replace(',', '.').trim();
  const kg = parseFloat(cleaned);
  if (Number.isFinite(kg) && kg > 0) return Math.round(kg * 1000);
  return 3000;
}

// Pick the right Shipmondo shipment template based on the Stripe shipping display name.
function pickTemplateId(shippingName, templates) {
  const name = (shippingName || '').toLowerCase();
  if (name.includes('pakkeshop')) return templates.gls_pakkeshop;
  if (name.includes('privat')) return templates.gls_privat;
  // Fallback
  return templates.gls_privat || templates.gls_pakkeshop;
}

// Basic country-name → ISO-2 fallback (Stripe gives ISO-2 already, but Shipmondo expects ISO-2 too)
function normalizeCountry(c) {
  if (!c) return 'DK';
  return String(c).toUpperCase().slice(0, 2);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event;
  let rawBody;
  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Only act on completed checkouts
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;

  try {
    // Expand session to get line items + shipping details
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'shipping_cost.shipping_rate', 'customer_details'],
    });

    const customer = full.customer_details || {};
    const shippingDetails = full.collected_information?.shipping_details || full.shipping_details || full.shipping || {};
    const address = shippingDetails.address || customer.address || {};
    const name = shippingDetails.name || customer.name || 'Kunde';

    const shippingRate = full.shipping_cost?.shipping_rate;
    const shippingDisplayName = shippingRate?.display_name || '';

    let templates = {};
    try { templates = JSON.parse(process.env.SHIPMENT_TEMPLATES || '{}'); }
    catch (e) { console.warn('SHIPMENT_TEMPLATES is not valid JSON'); }

    const templateId = pickTemplateId(shippingDisplayName, templates);
    if (!templateId) {
      console.error('No template matched for shipping:', shippingDisplayName);
      return res.status(500).json({ error: 'No shipment template matched' });
    }

    // Build parcel list from line items. Each Stripe line becomes one colli in Shipmondo,
    // using the weight parsed from the product description (which contains the size label).
    const lineItems = full.line_items?.data || [];
    const parcels = [];
    for (const li of lineItems) {
      const description = li.description || li.price?.product?.description || '';
      // Description is like "Dalarna – Fuldkornshvedemel" (built in checkout.js);
      // size label went into the Stripe line's product description in checkout, so we also
      // pull it from there — but checkout.js put weight in description's prefix ("12,5 kg · ...").
      // Since we can't read product metadata here, fall back to a heuristic.
      const weightMatch = description.match(/(\d+[,.]?\d*)\s*kg/i);
      const weightGrams = weightMatch ? parseWeightGrams(weightMatch[1] + ' kg') : 3000;
      const qty = li.quantity || 1;
      for (let i = 0; i < qty; i++) {
        parcels.push({ weight: weightGrams });
      }
    }
    if (parcels.length === 0) {
      // At least one placeholder parcel so Shipmondo accepts the draft
      parcels.push({ weight: 3000 });
    }

    // Build line items from the Stripe cart
    const orderItems = [];
    for (const li of lineItems) {
      const qty = li.quantity || 1;
      orderItems.push({
        item_no: li.id || `item-${orderItems.length + 1}`,
        name: li.description || 'Produkt',
        quantity: qty,
        unit_price: (li.amount_total && qty) ? Math.round(li.amount_total / qty) / 100 : 0,
      });
    }

    // Sales order payload — Shipmondo wraps everything under `sales_order` and uses `ship_to`.
    const payload = {
      sales_order: {
        order_id: session.id,
        order_date: new Date().toISOString(),
        currency_code: 'DKK',
        order_amount: (full.amount_total || 0) / 100,
        paid_amount: (full.amount_total || 0) / 100,
        payment_status: 'paid',
        order_status: 'new',
        reference: session.id,
        shipment_template_id: templateId,
        ship_to: {
          name,
          attention: name,
          address1: address.line1 || '',
          address2: address.line2 || '',
          zipcode: address.postal_code || '',
          city: address.city || '',
          country_code: normalizeCountry(address.country),
          email: customer.email || '',
          mobile: customer.phone || '',
        },
        order_lines: orderItems,
        action: 'none',
      },
    };

    const auth = Buffer.from(`${process.env.SHIPMONDO_USER}:${process.env.SHIPMONDO_KEY}`).toString('base64');
    const smRes = await fetch('https://app.shipmondo.com/api/public/v3/sales_orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const smText = await smRes.text();
    if (!smRes.ok) {
      console.error('Shipmondo API error', smRes.status, smText);
      // Return 200 so Stripe doesn't keep retrying — we log the failure for manual handling
      return res.status(200).json({ received: true, shipmondo_error: smText });
    }

    console.log('Shipmondo draft created for session', session.id);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Return 200 anyway to avoid Stripe retry storms; the error is in Vercel logs
    return res.status(200).json({ received: true, error: err.message });
  }
}
