// Daily check — triggered once a day by Vercel Cron (see vercel.json).
//
// 1) If there are active Click & Collect orders that have NOT had their
//    locker code sent yet, email the owner a morning summary.
// 2) If a locker code was sent more than 3 days ago and the order still
//    hasn't been collected (order still active), email the customer ONE
//    friendly reminder with their door(s) and code again.

const OWNER_EMAIL = process.env.ADMIN_EMAIL || 'hello@quartzmolle.dk';
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export default async function handler(req, res) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the env var
  // is set. If it is configured, require it.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { kv } = await import('@vercel/kv');

  // Run at most once per calendar day, even if the endpoint is hit again.
  const today = new Date().toISOString().slice(0, 10);
  try {
    const first = await kv.set(`dailycheck:${today}`, 1, { nx: true, ex: 172800 });
    if (!first) return res.status(200).json({ ok: true, skipped: 'already ran today' });
  } catch {}

  let orders = [];
  let fulfilled = {};
  try { orders = (await kv.lrange('pickup:orders', 0, -1)) || []; } catch {}
  try { fulfilled = (await kv.hgetall('pickup:fulfilled')) || {}; } catch {}

  const now = Date.now();
  const result = { ownerMail: false, reminders: 0 };

  // ── 1) Morning summary to the owner about orders not yet in a locker ──
  const waiting = orders.filter(o => o && o.ref && !fulfilled[o.ref]);
  if (waiting.length) {
    const rows = waiting.map(o => {
      const days = o.createdAt ? Math.floor((now - o.createdAt) / 86400000) : null;
      const age = days === null ? '' : days === 0 ? ' (i dag)' : ` (${days} dag${days === 1 ? '' : 'e'} gammel)`;
      const items = (o.items || []).map(it => `${it.qty || 1}× ${it.name}${it.weightLabel ? ' ' + it.weightLabel : ''}`).join(', ');
      return `<li style="margin-bottom:8px;"><strong>#${esc(o.ref)}</strong> – ${esc(o.name || 'Kunde')}${age}<br>` +
             `<span style="color:#6b6256;font-size:13px;">${esc(items || '—')}</span></li>`;
    }).join('');
    await sendEmail(
      OWNER_EMAIL,
      `${waiting.length} ordre${waiting.length === 1 ? '' : 'r'} venter på at komme i lockeren`,
      `<h2 style="color:#273071;margin:0 0 12px;">Godmorgen 👋</h2>` +
      `<p style="margin:0 0 14px;">Disse Click &amp; Collect-ordrer er betalt, men har endnu ikke fået en skabskode:</p>` +
      `<ul style="padding-left:18px;margin:0 0 16px;">${rows}</ul>` +
      `<p style="margin:0;"><a href="https://quartzmolle.dk/fufill" style="color:#273071;font-weight:600;">Åbn ordre-fulfillment →</a></p>`
    );
    result.ownerMail = true;
  }

  // ── 2) Reminder to customers who haven't collected after 3 days ──
  const activeRefs = new Set(orders.filter(o => o && o.ref).map(o => o.ref));
  for (const [ref, rec] of Object.entries(fulfilled)) {
    if (!rec || !rec.email || !rec.sentAt) continue;
    if (rec.reminded) continue;                   // only one reminder per order
    if (!activeRefs.has(ref)) continue;           // order deleted = collected
    if (now - rec.sentAt < REMIND_AFTER_MS) continue;

    const slots = Array.isArray(rec.slots) ? rec.slots : [];
    const doors = (rec.doors || slots.map(s => s.door)).join(', ');
    const codes = [...new Set(slots.map(s => s.code).filter(Boolean))];
    const codeHtml = codes.length === 1
      ? `<p style="margin:0 0 6px;">Kode: <strong style="font-size:20px;letter-spacing:2px;">${esc(codes[0])}</strong></p>`
      : slots.map(s => `<p style="margin:0 0 4px;">Skab ${s.door}: <strong>${esc(s.code)}</strong></p>`).join('');

    try {
      await sendEmail(
        rec.email,
        `Husk din ordre #${ref} – den venter på dig 🌾`,
        `<h2 style="color:#273071;margin:0 0 12px;">Din ordre venter stadig</h2>` +
        `<p style="margin:0 0 14px;">Bare en venlig påmindelse: din ordre <strong>#${esc(ref)}</strong> ligger klar i vores afhentningsskab og glæder sig til at komme hjem til dig.</p>` +
        `<p style="margin:0 0 6px;">Skab${(rec.doors || []).length > 1 ? 'e' : ''}: <strong>${esc(doors)}</strong></p>` +
        codeHtml +
        `<p style="margin:14px 0 0;color:#6b6256;font-size:13px;">Afhentning: Suså Landevej 101, 4160 Herlufmagle<br>Quartz Mølle · hello@quartzmolle.dk</p>`
      );
      const updated = { ...rec, reminded: true, remindedAt: now };
      try { await kv.hset('pickup:fulfilled', { [ref]: updated }); } catch {}
      result.reminders++;
    } catch (e) {
      console.error('Reminder email failed for', ref, e);
    }
  }

  return res.status(200).json({ ok: true, ...result });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function sendEmail(to, subject, innerHtml) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const html =
    `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;` +
    `max-width:520px;margin:0 auto;padding:28px 22px;background:#f5f1e8;border-radius:16px;color:#1a1611;">` +
    innerHtml +
    `</div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'Quartz Mølle <order@quartzmolle.dk>', to: [to], subject, html }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Resend ${r.status}: ${t}`);
  }
}
