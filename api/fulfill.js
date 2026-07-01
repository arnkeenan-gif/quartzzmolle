// api/fulfill.js — Click & Collect fulfilment for the pickup locker ("skab").
//
// Staff page /fulfill lists recent Click & Collect webshop orders (persisted by
// the Stripe webhook) and the currently-active locker codes (from the /locker
// system). Staff enter the cabinet/door number for an order; we look up that
// door's code from the locker state and email the customer their door + code
// via Resend.
//
// Auth: shares the /locker session cookie (lk_sess) — log in once on /locker
// (or on /fulfill with the same passcode) and both pages work.
//   action=list -> { orders, fulfilled, lockers }
//   action=send -> { ref, door } -> emails the customer, records fulfilment

import { kv } from '@vercel/kv';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.LOCKER_SESSION_SECRET || 'CHANGE_ME_IN_VERCEL_ENV';
const PICKUP_ADDRESS = 'Suså Landevej 101, 4160 Herlufmagle';

// Verify the HMAC-signed lk_sess cookie set by /api/locker (action=login).
function checkAuth(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)lk_sess=([^;]+)/);
  if (!m) return false;
  const tok = decodeURIComponent(m[1]);
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return false;
  const data = tok.slice(0, dot), mac = tok.slice(dot + 1);
  const expect = createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  try {
    if (mac.length !== expect.length) return false;
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expect, 'hex'))) return false;
  } catch { return false; }
  const exp = parseInt(data, 10);
  return Number.isFinite(exp) && exp > Date.now();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function getLockerCodeForDoor(door) {
  try {
    const s = await kv.get('locker:state');
    const lockers = (s && s.lockers) || [];
    const t = lockers.find(l => l.door === door);
    return t && t.occ && t.code ? t.code : null;
  } catch {
    return null;
  }
}

async function activeLockerCodes() {
  try {
    const s = await kv.get('locker:state');
    const lockers = (s && s.lockers) || [];
    return lockers
      .filter(l => l.occ && l.code)
      .map(l => ({ door: l.door, code: l.code, since: l.since || 0 }))
      .sort((a, b) => a.door - b.door);
  } catch {
    return [];
  }
}

async function sendPickupReadyEmail(order, slots) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const email = order.email;
  if (!email) throw new Error('Order has no customer email');

  const firstName = (order.name || '').split(' ')[0] || '';
  const orderRef = order.ref;
  const siteUrl = 'https://quartzmolle.dk';
  const logoUrl = `${siteUrl}/images/logopng.png`;

  // Some orders span more than one locker door. A multi-deposit shares one code
  // across its doors; if codes differ we list each door with its own code.
  const slotsArr = Array.isArray(slots) ? slots : [];
  const doors = slotsArr.map(s => s.door);
  const uniqCodes = [...new Set(slotsArr.map(s => String(s.code)))];
  const sharedCode = uniqCodes.length === 1 ? uniqCodes[0] : null;
  const multi = doors.length > 1;

  const cell = (label, value) =>
    `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin-bottom:8px;">${label}</div>` +
    `<div style="font-size:34px;font-weight:800;color:#273071;line-height:1.05;letter-spacing:0.04em;">${escapeHtml(String(value))}</div>`;

  let codeBlockHtml;
  if (!multi) {
    codeBlockHtml =
      `<tr><td style="padding:22px;text-align:center;border-right:1px solid #eee;">${cell('Skab / låge', doors[0])}</td>` +
      `<td style="padding:22px;text-align:center;">${cell('Kode', sharedCode)}</td></tr>`;
  } else if (sharedCode) {
    codeBlockHtml =
      `<tr><td style="padding:22px;text-align:center;border-right:1px solid #eee;">${cell('Skabe / låger', doors.join(', '))}</td>` +
      `<td style="padding:22px;text-align:center;">${cell('Fælles kode', sharedCode)}</td></tr>`;
  } else {
    codeBlockHtml = slotsArr.map((s, i) =>
      `<tr><td style="padding:18px 22px;text-align:center;border-right:1px solid #eee;${i ? 'border-top:1px solid #eee;' : ''}">${cell('Skab / låge', s.door)}</td>` +
      `<td style="padding:18px 22px;text-align:center;${i ? 'border-top:1px solid #eee;' : ''}">${cell('Kode', s.code)}</td></tr>`
    ).join('');
  }

  const introLine = multi
    ? `Din ordre <strong>#${escapeHtml(orderRef)}</strong> fylder ${doors.length} skabe og ligger nu klar til afhentning. Brug koden herunder til at åbne lågerne.`
    : `Din ordre <strong>#${escapeHtml(orderRef)}</strong> ligger nu klar i vores afhentningsskab. Brug koden herunder til at åbne den rigtige låge.`;

  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light only"/><title>Din ordre er klar til afhentning</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;">
    <tr><td align="center" style="padding:32px 16px;">
      <a href="${siteUrl}" style="text-decoration:none;display:inline-block;margin-bottom:24px;">
        <img src="${logoUrl}" alt="Quartz Mølle" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:50%;" />
      </a>
      <table role="presentation" width="100%" style="max-width:520px;background:#f5f1e8;border-radius:16px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0" bgcolor="#f5f1e8">
        <tr><td style="background:#273071;color:#fff;padding:40px 32px 32px;text-align:center;">
          <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.75;margin-bottom:10px;font-weight:500;">Click &amp; Collect</div>
          <div style="font-size:24px;font-weight:700;letter-spacing:-0.01em;line-height:1.25;">Din ordre er klar til afhentning${firstName ? ',<br/>' + escapeHtml(firstName) : ''}</div>
        </td></tr>
        <tr><td style="padding:32px 36px 8px;">
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#444;">
            ${introLine}
          </p>
        </td></tr>
        <tr><td style="padding:0 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e0d9c8;">
            ${codeBlockHtml}
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 8px;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin-bottom:10px;">Afhentning</div>
          <div style="font-size:15px;color:#222;font-weight:500;">${escapeHtml(PICKUP_ADDRESS)}</div>
        </td></tr>
        <tr><td style="padding:28px 36px 36px;border-top:1px solid #eee;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#666;line-height:1.7;text-align:center;">
            Har du spørgsmål? Skriv til <a href="mailto:hello@quartzmolle.dk" style="color:#273071;text-decoration:none;font-weight:500;">hello@quartzmolle.dk</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Quartz Mølle <order@quartzmolle.dk>',
      to: [email],
      subject: `Din ordre #${orderRef} er klar til afhentning – Quartz Mølle`,
      html,
    }),
  });
  if (!resendRes.ok) {
    const errTxt = await resendRes.text();
    console.error('Resend API error', resendRes.status, errTxt);
    throw new Error('Resend send failed');
  }
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = (req.body && req.body.action) || (req.query && req.query.action) ||
                 (req.method === 'GET' ? 'list' : '');

  try {
    if (action === 'list') {
      let orders = [];
      try { orders = (await kv.lrange('pickup:orders', 0, 49)) || []; } catch {}
      let fulfilled = {};
      try { fulfilled = (await kv.hgetall('pickup:fulfilled')) || {}; } catch {}
      const lockers = await activeLockerCodes();
      return res.status(200).json({ ok: true, orders, fulfilled, lockers });
    }

    if (action === 'send') {
      const ref = (req.body && req.body.ref || '').toString().trim();
      if (!ref) return res.status(400).json({ error: 'Mangler ordre-reference' });

      // Accept one or several doors. The frontend may send `doors` (array or
      // comma/space-separated string) or a single `door`.
      let rawDoors = req.body && (req.body.doors != null ? req.body.doors : req.body.door);
      if (typeof rawDoors === 'string') rawDoors = rawDoors.split(/[\s,]+/);
      if (!Array.isArray(rawDoors)) rawDoors = [rawDoors];
      const doors = [...new Set(rawDoors.map(d => parseInt(d, 10)).filter(d => d >= 1 && d <= 22))];
      if (!doors.length) return res.status(400).json({ error: 'Skriv et skab-/dør-nummer først.' });

      // Find the order by ref in the recent pickup list
      let orders = [];
      try { orders = (await kv.lrange('pickup:orders', 0, 199)) || []; } catch {}
      const order = orders.find(o => o && o.ref === ref);
      if (!order) return res.status(404).json({ error: 'Ordren blev ikke fundet' });

      // Resolve each door's code from the locker state.
      const slots = [];
      for (const d of doors) {
        const c = await getLockerCodeForDoor(d);
        if (!c) {
          return res.status(409).json({ error: `Skab ${d} har ingen aktiv kode. Deponer ordren i skabet på /locker først.` });
        }
        slots.push({ door: d, code: c });
      }

      await sendPickupReadyEmail(order, slots);

      const record = { doors, slots, email: order.email, sentAt: Date.now() };
      try { await kv.hset('pickup:fulfilled', { [ref]: record }); } catch (e) { console.error('Failed to record fulfilment:', e); }

      return res.status(200).json({ ok: true, ref, slots });
    }

    if (action === 'delete') {
      const ref = (req.body && req.body.ref || '').toString().trim();
      if (!ref) return res.status(400).json({ error: 'Mangler ordre-reference' });

      // Rewrite the pickup list without this order, and drop any fulfilment record.
      let orders = [];
      try { orders = (await kv.lrange('pickup:orders', 0, -1)) || []; } catch {}
      const remaining = orders.filter(o => o && o.ref !== ref);
      const removed = orders.length - remaining.length;
      try {
        await kv.del('pickup:orders');
        if (remaining.length) await kv.rpush('pickup:orders', ...remaining);
      } catch (e) {
        console.error('Failed to rewrite pickup list on delete:', e);
        return res.status(500).json({ error: 'Kunne ikke slette ordren' });
      }
      try { await kv.hdel('pickup:fulfilled', ref); } catch {}

      return res.status(200).json({ ok: true, ref, removed });
    }

    return res.status(400).json({ error: 'Ukendt handling' });
  } catch (err) {
    console.error('fulfill error', err);
    return res.status(500).json({ error: err.message || 'Serverfejl' });
  }
}
