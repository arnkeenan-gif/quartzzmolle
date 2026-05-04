// api/stripe-webhook.js — Vercel Serverless Function
//
// Handles Stripe events for BOTH:
//   - checkout.session.completed (legacy Stripe Checkout redirect flow)
//   - payment_intent.succeeded   (new custom Stripe Elements checkout flow)

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeCountry(c) {
  if (!c) return 'DK';
  return String(c).toUpperCase().slice(0, 2);
}

function pickTemplateId(deliveryKey, shippingName, templates) {
  if (deliveryKey && templates[deliveryKey]) return templates[deliveryKey];
  const name = (shippingName || '').toLowerCase();
  if (name.includes('pakkeshop')) return templates.gls_pakkeshop;
  if (name.includes('privat')) return templates.gls_privat;
  return templates.gls_privat || templates.gls_pakkeshop;
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
  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    let orderData = null;

    if (event.type === 'payment_intent.succeeded') {
      // CRITICAL: re-fetch the PaymentIntent fresh from Stripe so we get the LATEST
      // metadata (including pakkeshop info that may have been updated between
      // payment attempt and webhook firing).
      const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
      const freshPI = await stripe.paymentIntents.retrieve(event.data.object.id);
      orderData = parsePaymentIntent(freshPI);
    } else if (event.type === 'checkout.session.completed') {
      orderData = await parseCheckoutSession(event.data.object);
    } else {
      return res.status(200).json({ received: true, skipped: event.type });
    }

    if (!orderData) {
      return res.status(200).json({ received: true, skipped: 'no order data' });
    }

    let templates = {};
    try { templates = JSON.parse(process.env.SHIPMENT_TEMPLATES || '{}'); } catch {}
    const templateId = pickTemplateId(orderData.deliveryKey, orderData.shippingDisplayName, templates);
    if (!templateId) {
      console.error('No template matched. deliveryKey=', orderData.deliveryKey, 'shippingName=', orderData.shippingDisplayName);
      return res.status(200).json({ received: true, error: 'No template matched' });
    }

    const VAT_FRAC = 0.25;
    const shortId = String(orderData.externalId).slice(-50);
    const refId = String(orderData.externalId).slice(-40);
    const orderAmountKr = orderData.amountKr;
    const orderAmountExclVat = Number((orderAmountKr / 1.25).toFixed(2));
    const orderVatAmount = Number((orderAmountKr - orderAmountExclVat).toFixed(2));

    const orderLines = orderData.items.map((it, idx) => {
      const qty = it.qty || 1;
      const unitInclVat = it.price;
      const unitExclVat = unitInclVat / (1 + VAT_FRAC);
      const parts = [it.productName];
      if (it.productType) parts.push(it.productType);
      if (it.weightLabel) parts.push(it.weightLabel);
      return {
        line_type: 'item',
        item_no: `item-${idx + 1}`,
        item_name: parts.join(' – '),
        quantity: qty,
        unit_price_excluding_vat: unitExclVat.toFixed(2),
        vat_percent: VAT_FRAC,
        currency_code: 'DKK',
      };
    });

    const shipTo = {
      name: orderData.customerName,
      attention: orderData.customerName,
      address1: orderData.address.line1 || '',
      address2: orderData.address.line2 || '',
      zipcode: orderData.address.postal_code || '',
      city: orderData.address.city || '',
      country_code: normalizeCountry(orderData.address.country),
      email: orderData.customerEmail,
      mobile: orderData.customerPhone,
    };

    const payload = {
      order_id: shortId,
      order_date: new Date().toISOString(),
      currency_code: 'DKK',
      order_amount: orderAmountKr,
      order_amount_incl_vat: orderAmountKr,
      order_amount_excl_vat: orderAmountExclVat,
      order_vat_amount: orderVatAmount,
      paid_amount: orderAmountKr,
      payment_status: 'paid',
      payment_details: {
        payment_method: 'Stripe',
        transaction_id: String(orderData.transactionId).slice(-50),
        amount_including_vat: orderAmountKr,
        amount_excluding_vat: orderAmountExclVat,
        captured_amount: orderAmountKr,
        authorized_amount: orderAmountKr,
        currency_code: 'DKK',
        vat_amount: orderVatAmount,
        vat_percent: VAT_FRAC,
      },
      order_status: 'new',
      reference: refId,
      shipment_template_id: templateId,
      ship_to: shipTo,
      order_lines: orderLines,
      action: 'ship',
    };

    // If customer picked a specific pakkeshop, pass it as the service point
    if (orderData.pakkeshop && orderData.pakkeshop.id) {
      payload.service_point = {
        id: orderData.pakkeshop.id,
        name: orderData.pakkeshop.name,
        address1: orderData.pakkeshop.address,
        zipcode: orderData.pakkeshop.zipcode,
        city: orderData.pakkeshop.city,
        country_code: 'DK',
        shipping_agent: 'gls',
      };
    }

    const auth = Buffer.from(`${process.env.SHIPMONDO_USER}:${process.env.SHIPMONDO_KEY}`).toString('base64');
    console.log('Shipmondo payload:', JSON.stringify(payload));
    const smRes = await fetch('https://app.shipmondo.com/api/public/v3/sales_orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const smText = await smRes.text();
    console.log('Shipmondo response', smRes.status, smText);
    if (!smRes.ok) {
      console.error('Shipmondo API error', smRes.status, smText);
      return res.status(200).json({ received: true, shipmondo_error: smText });
    }

    console.log('Shipmondo draft created for', orderData.externalId);

    // Send branded order confirmation email (best-effort, don't fail webhook if email fails)
    try {
      await sendOrderConfirmationEmail(orderData);
    } catch (emailErr) {
      console.error('Order confirmation email failed:', emailErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
}

// ── ORDER CONFIRMATION EMAIL ──
async function sendOrderConfirmationEmail(orderData) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping order confirmation email');
    return;
  }
  const email = orderData.customerEmail || orderData.email;
  if (!email) {
    console.warn('No customer email — skipping order confirmation email');
    return;
  }

  const fullName = orderData.customerName || orderData.name || '';
  const customerName = fullName.split(' ')[0]; // first name only
  const orderRef = String(orderData.externalId).slice(-12).toUpperCase();
  const deliveryLabel = orderData.deliveryKey === 'gls_pakkeshop' ? 'GLS Pakkeshop' : 'GLS Privatadresse';
  const totalKr = Number(orderData.amountKr).toFixed(2).replace('.', ',');

  const itemsHtml = (orderData.items || []).map(it => {
    const name = it.productName + (it.weightLabel ? ` – ${it.weightLabel}` : '');
    const lineTotal = (Number(it.price) * Number(it.qty)).toFixed(2).replace('.', ',');
    const imgCell = it.image
      ? `<td style="padding:12px 14px 12px 0;border-bottom:1px solid #eee;width:64px;vertical-align:middle;">
           <img src="${escapeHtmlEmail(it.image)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:8px;object-fit:cover;background:#f5f1e8;" />
         </td>`
      : '';
    return `
      <tr>
        ${imgCell}
        <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;vertical-align:middle;">
          ${escapeHtmlEmail(name)} <span style="color:#888;">× ${it.qty}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;text-align:right;font-variant-numeric:tabular-nums;vertical-align:middle;">
          ${lineTotal} kr.
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8" /><title>Tak for din ordre</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);" cellpadding="0" cellspacing="0">
        <tr><td style="background:#273071;color:#fff;padding:36px 32px 28px;text-align:center;">
          <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:6px;">Quartz Mølle</div>
          <div style="font-size:24px;font-weight:700;letter-spacing:-0.01em;">Tak for din ordre${customerName ? ', ' + escapeHtmlEmail(customerName) : ''}!</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
            Vi har modtaget din ordre og pakker den hurtigst muligt. Du får en ny e-mail med tracking når pakken er afsendt.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#666;">
            <strong style="color:#222;">Ordrenummer:</strong> ${escapeHtmlEmail(orderRef)}
          </p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td colspan="2" style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#888;padding-bottom:8px;">Din ordre</td></tr>
            ${itemsHtml}
            <tr><td style="padding:16px 0 0;font-weight:600;color:#222;">I alt</td>
                <td style="padding:16px 0 0;text-align:right;font-size:18px;font-weight:700;color:#273071;font-variant-numeric:tabular-nums;">${totalKr} kr.</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:8px;">Levering</div>
          <div style="font-size:15px;color:#333;">${escapeHtmlEmail(deliveryLabel)}</div>
          <div style="font-size:13px;color:#777;margin-top:4px;">1–3 hverdage efter afsendelse</div>
        </td></tr>
        <tr><td style="padding:24px 32px 36px;">
          <p style="margin:0;font-size:13px;color:#777;line-height:1.6;">
            Har du spørgsmål? Skriv til <a href="mailto:hello@quartzmolle.dk" style="color:#273071;text-decoration:none;">hello@quartzmolle.dk</a>
          </p>
        </td></tr>
        <tr><td style="background:#f5f1e8;padding:20px 32px;text-align:center;font-size:12px;color:#888;">
          Quartz Mølle · Suså Landevej 101, 4160 Herlufmagle · Danmark
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Quartz Mølle <ordre@quartzmolle.dk>',
      to: [email],
      subject: `Tak for din ordre #${orderRef} – Quartz Mølle`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errTxt = await resendRes.text();
    console.error('Resend API error', resendRes.status, errTxt);
    throw new Error('Resend send failed');
  }
  console.log('Order confirmation email sent to', email);
}

function escapeHtmlEmail(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parsePaymentIntent(pi) {
  const meta = pi.metadata || {};
  console.log('Webhook received PI metadata:', JSON.stringify(meta));
  const shipping = pi.shipping || {};
  // Prefer metadata fields (set by our backend), fall back to pi.shipping
  const address = {
    line1: meta.customer_address1 || shipping.address?.line1 || '',
    line2: shipping.address?.line2 || '',
    postal_code: meta.customer_zipcode || shipping.address?.postal_code || '',
    city: meta.customer_city || shipping.address?.city || '',
    country: meta.customer_country || shipping.address?.country || 'DK',
  };

  const items = [];
  if (meta.items_summary) {
    for (const chunk of meta.items_summary.split(';')) {
      const [productName, weightLabel, qty, price] = chunk.split('|');
      if (productName && qty && price) {
        items.push({
          productName,
          productType: '',
          weightLabel: weightLabel || '',
          qty: parseInt(qty, 10) || 1,
          price: parseFloat(price) || 0,
        });
      }
    }
  }

  let pakkeshop = null;
  if (meta.pakkeshop_id) {
    pakkeshop = {
      id: meta.pakkeshop_id,
      name: meta.pakkeshop_name || '',
      address: meta.pakkeshop_address || '',
      zipcode: meta.pakkeshop_zipcode || '',
      city: meta.pakkeshop_city || '',
    };
  }

  return {
    externalId: pi.id,
    transactionId: pi.id,
    amountKr: (pi.amount_received || pi.amount || 0) / 100,
    customerName: meta.customer_name || shipping.name || 'Kunde',
    customerEmail: meta.customer_email || pi.receipt_email || '',
    customerPhone: meta.customer_phone || shipping.phone || '',
    address,
    deliveryKey: meta.delivery_method || 'gls_privat',
    shippingDisplayName: '',
    items,
    pakkeshop,
  };
}

async function parseCheckoutSession(session) {
  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price.product', 'shipping_cost.shipping_rate', 'customer_details'],
  });
  const customer = full.customer_details || {};
  const shippingDetails = full.collected_information?.shipping_details || full.shipping_details || full.shipping || {};
  const address = shippingDetails.address || customer.address || {};
  const name = shippingDetails.name || customer.name || 'Kunde';
  const shippingRate = full.shipping_cost?.shipping_rate;
  const shippingDisplayName = shippingRate?.display_name || '';

  const lineItems = full.line_items?.data || [];
  const items = lineItems.map(li => {
    const descField = li.price?.product?.description || '';
    const weightMatch = descField.match(/(\d+[,.]?\d*)\s*kg/i);
    const productImages = li.price?.product?.images || [];
    return {
      productName: li.description || li.price?.product?.name || 'Produkt',
      productType: '',
      weightLabel: weightMatch ? weightMatch[0] : '',
      qty: li.quantity || 1,
      price: ((li.amount_total || 0) / (li.quantity || 1)) / 100,
      image: productImages[0] || null,
    };
  });

  return {
    externalId: full.id,
    transactionId: full.payment_intent || full.id,
    amountKr: (full.amount_total || 0) / 100,
    customerName: name,
    customerEmail: customer.email || '',
    customerPhone: customer.phone || '',
    address,
    deliveryKey: null,
    shippingDisplayName,
    items,
  };
}
