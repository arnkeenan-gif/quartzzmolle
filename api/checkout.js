// ============================================================
// QUARTZ MØLLE — CUSTOM CHECKOUT
// Address form + delivery picker + Stripe Elements payment
// ============================================================

// Change to pk_test_... when testing; pk_live_... in production
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51L5wKqCCp2Usx7QSCdRAk3JMWtoKxZcrRi0V99qHiPsRQHQC9h5q4ZZmzjSdDqliSIUVEvKD60sB54tuaKw9VZfr00HLho5fWW';

const DELIVERY_OPTIONS = [
  { id: 'gls_pakkeshop', name: 'GLS Pakkeshop', desc: 'Afhent i din lokale pakkeshop · 1-3 hverdage', price: 4900 },
  { id: 'gls_privat',    name: 'GLS Privatadresse', desc: 'Levering direkte til døren · 1-3 hverdage', price: 6900 },
];

const state = {
  items: [],
  delivery: 'gls_privat', // default
  pakkeshop: null,        // { id, name, address } when selected
  customer: {},           // name, email, phone, address fields
  stripe: null,
  elements: null,
  paymentElement: null,
  clientSecret: null,
};

// ─── Bootstrap ───
document.addEventListener('DOMContentLoaded', () => {
  state.items = (window.readCart ? window.readCart() : readCartFallback());
  if (state.items.length === 0) {
    document.getElementById('checkout-content').innerHTML = `
      <div class="card cart-empty-msg">
        <h2>Din kurv er tom</h2>
        <p>Læg noget i kurven før du går til kassen.</p>
        <a href="shop.html" class="btn-dark" style="display:inline-block;margin-top:1rem;padding:0.8rem 2rem;text-decoration:none;border-radius:8px;background:#000;color:#fff;">Gå til shop</a>
      </div>`;
    return;
  }
  renderCheckout();
});

function readCartFallback() {
  try {
    const raw = localStorage.getItem('quartzmolle_cart_v1');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Render main checkout ───
function renderCheckout() {
  const root = document.getElementById('checkout-content');
  root.innerHTML = `
    <div class="checkout-grid">
      <div class="checkout-left">
        <div class="card">
          <h2>Kontakt</h2>
          <div class="form-row full">
            <div class="form-field">
              <label for="f-email">Email</label>
              <input type="email" id="f-email" required autocomplete="email" />
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Leveringsadresse</h2>
          <div class="form-row">
            <div class="form-field">
              <label for="f-firstname">Fornavn</label>
              <input type="text" id="f-firstname" required autocomplete="given-name" />
            </div>
            <div class="form-field">
              <label for="f-lastname">Efternavn</label>
              <input type="text" id="f-lastname" required autocomplete="family-name" />
            </div>
          </div>
          <div class="form-row full">
            <div class="form-field">
              <label for="f-address">Adresse</label>
              <input type="text" id="f-address" required autocomplete="street-address" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="f-zip">Postnummer</label>
              <input type="text" id="f-zip" required autocomplete="postal-code" />
            </div>
            <div class="form-field">
              <label for="f-city">By</label>
              <input type="text" id="f-city" required autocomplete="address-level2" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="f-phone">Telefon</label>
              <input type="tel" id="f-phone" required autocomplete="tel" placeholder="+45 ..." />
            </div>
            <div class="form-field">
              <label for="f-country">Land</label>
              <select id="f-country">
                <option value="DK" selected>Danmark</option>
                <option value="SE">Sverige</option>
                <option value="NO">Norge</option>
                <option value="DE">Tyskland</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Levering</h2>
          <div class="delivery-options" id="delivery-options"></div>
          <div class="pakkeshop-picker" id="pakkeshop-picker">
            <p>Vælg en pakkeshop i nærheden af din adresse:</p>
            <div id="pakkeshop-list" class="pakkeshop-list">
              <p class="pakkeshop-hint">Udfyld postnummer først, så finder vi de nærmeste pakkeshops.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="checkout-right">
        <div class="card">
          <h2>Din ordre</h2>
          <div id="summary-items" class="summary-items"></div>
          <div id="summary-totals" class="summary-totals"></div>
        </div>

        <div class="card">
          <h2>Betaling</h2>
          <div id="payment-element">
            <p style="color:#999;font-size:0.9rem;">Udfyld dine oplysninger først...</p>
          </div>
          <button class="btn-pay" id="pay-btn" disabled>Betal</button>
          <p class="pay-error" id="pay-error"></p>
          <p class="secure-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Sikker betaling via Stripe
          </p>
        </div>
      </div>
    </div>
  `;

  renderDeliveryOptions();
  renderSummary();
  wireFormListeners();
  initStripe();
}

// ─── Delivery options ───
function renderDeliveryOptions() {
  const container = document.getElementById('delivery-options');
  container.innerHTML = DELIVERY_OPTIONS.map(opt => `
    <div class="delivery-card ${opt.id === state.delivery ? 'selected' : ''}" data-id="${opt.id}">
      <div class="delivery-radio"></div>
      <div class="delivery-info">
        <div class="delivery-title">${opt.name}</div>
        <div class="delivery-desc">${opt.desc}</div>
      </div>
      <div class="delivery-price">${(opt.price / 100).toFixed(0)} kr.</div>
    </div>
  `).join('');

  container.querySelectorAll('.delivery-card').forEach(card => {
    card.addEventListener('click', () => {
      state.delivery = card.dataset.id;
      renderDeliveryOptions();
      renderSummary();
      updatePakkeshopPicker();
      refreshPaymentIntent();
    });
  });

  updatePakkeshopPicker();
}

function updatePakkeshopPicker() {
  const picker = document.getElementById('pakkeshop-picker');
  if (!picker) return;
  if (state.delivery === 'gls_pakkeshop') {
    picker.classList.add('active');
    // Load shops if zip is filled
    const zip = document.getElementById('f-zip')?.value.trim();
    if (zip && zip.length >= 4) {
      loadPakkeshops(zip);
    }
  } else {
    picker.classList.remove('active');
    state.pakkeshop = null;
  }
}

async function loadPakkeshops(zipcode) {
  const listEl = document.getElementById('pakkeshop-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="pakkeshop-hint">Henter pakkeshops...</p>';
  try {
    const street = document.getElementById('f-address')?.value.trim() || '';
    const params = new URLSearchParams({ zipcode });
    if (street) params.set('street', street);
    const res = await fetch(`/api/find-pakkeshops?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.shops) || data.shops.length === 0) {
      listEl.innerHTML = '<p class="pakkeshop-hint">Ingen pakkeshops fundet. Pakken sendes til nærmeste pakkeshop.</p>';
      return;
    }
    renderPakkeshopList(data.shops);
  } catch (err) {
    console.error('Pakkeshop load error:', err);
    listEl.innerHTML = '<p class="pakkeshop-hint">Kunne ikke hente pakkeshops. Pakken sendes til nærmeste pakkeshop.</p>';
  }
}

function renderPakkeshopList(shops) {
  const listEl = document.getElementById('pakkeshop-list');
  const limited = shops.slice(0, 8);
  listEl.innerHTML = limited.map(s => {
    const dist = s.distanceM ? `${(s.distanceM / 1000).toFixed(1)} km` : '';
    return `
    <div class="pakkeshop-item ${state.pakkeshop?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
      <div class="pakkeshop-radio"></div>
      <div class="pakkeshop-info">
        <div class="pakkeshop-name">${escapeHtml(s.name)}</div>
        <div class="pakkeshop-addr">${escapeHtml(s.address)}, ${escapeHtml(s.zipcode)} ${escapeHtml(s.city)}</div>
      </div>
      ${dist ? `<div class="pakkeshop-dist">${dist}</div>` : ''}
    </div>
  `;
  }).join('');
  state._shopCache = {};
  limited.forEach(s => { state._shopCache[s.id] = s; });

  listEl.querySelectorAll('.pakkeshop-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      state.pakkeshop = state._shopCache[id] || null;
      renderPakkeshopList(limited);
      refreshPaymentIntent();
    });
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─── Order summary ───
function renderSummary() {
  const itemsEl = document.getElementById('summary-items');
  itemsEl.innerHTML = state.items.map(it => `
    <div class="summary-item">
      <div>
        <div class="summary-item-name">${it.productName}</div>
        <span class="summary-item-sub">${it.productType} · ${it.weightLabel} × ${it.qty}</span>
      </div>
      <div class="summary-item-price">${(it.price * it.qty).toFixed(2).replace('.', ',')} kr.</div>
    </div>
  `).join('');

  const subtotalOre = state.items.reduce((s, it) => s + Math.round(it.price * 100) * it.qty, 0);
  const shippingOre = DELIVERY_OPTIONS.find(o => o.id === state.delivery)?.price || 0;
  const totalOre = subtotalOre + shippingOre;
  const vatOre = Math.round(totalOre - totalOre / 1.25);

  document.getElementById('summary-totals').innerHTML = `
    <div class="summary-total-row"><span>Subtotal</span><span>${(subtotalOre/100).toFixed(2).replace('.', ',')} kr.</span></div>
    <div class="summary-total-row"><span>Levering</span><span>${(shippingOre/100).toFixed(2).replace('.', ',')} kr.</span></div>
    <div class="summary-total-row"><span>Moms (25% inkl.)</span><span>${(vatOre/100).toFixed(2).replace('.', ',')} kr.</span></div>
    <div class="summary-total-row grand"><span>I alt</span><span>${(totalOre/100).toFixed(2).replace('.', ',')} kr.</span></div>
  `;
}

function calculateTotalOre() {
  const subtotalOre = state.items.reduce((s, it) => s + Math.round(it.price * 100) * it.qty, 0);
  const shippingOre = DELIVERY_OPTIONS.find(o => o.id === state.delivery)?.price || 0;
  return subtotalOre + shippingOre;
}

// ─── Form listeners ───
function wireFormListeners() {
  const fields = ['f-email','f-firstname','f-lastname','f-address','f-zip','f-city','f-phone','f-country'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', maybeInitPayment);
  });
  // Reload pakkeshops when zip or address changes
  let reloadTimer;
  function triggerPakkeshopReload() {
    if (state.delivery !== 'gls_pakkeshop') return;
    clearTimeout(reloadTimer);
    const listEl = document.getElementById('pakkeshop-list');
    if (listEl) listEl.innerHTML = '<p class="pakkeshop-hint">Henter pakkeshops...</p>';
    // Clear current selection since address changed
    state.pakkeshop = null;
    reloadTimer = setTimeout(() => {
      const zip = document.getElementById('f-zip').value.trim();
      if (zip.length >= 4) loadPakkeshops(zip);
    }, 400);
  }
  ['f-zip', 'f-address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', triggerPakkeshopReload);
      el.addEventListener('blur', triggerPakkeshopReload);
    }
  });
  document.getElementById('pay-btn').addEventListener('click', handlePay);
}

function collectCustomer() {
  return {
    email: document.getElementById('f-email').value.trim(),
    firstName: document.getElementById('f-firstname').value.trim(),
    lastName: document.getElementById('f-lastname').value.trim(),
    address: document.getElementById('f-address').value.trim(),
    zip: document.getElementById('f-zip').value.trim(),
    city: document.getElementById('f-city').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    country: document.getElementById('f-country').value,
  };
}

function isCustomerComplete(c) {
  return c.email && c.firstName && c.lastName && c.address && c.zip && c.city && c.phone;
}

// ─── Stripe init ───
function initStripe() {
  state.stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
}

async function maybeInitPayment() {
  const customer = collectCustomer();
  if (!isCustomerComplete(customer)) return;
  state.customer = customer;

  // Create/refresh PaymentIntent on backend
  try {
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.items,
        delivery: state.delivery,
        pakkeshop: state.pakkeshop,
        customer,
        amount: calculateTotalOre(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) {
      console.error('PaymentIntent error:', data);
      document.getElementById('pay-error').textContent = data.error || 'Kunne ikke forberede betaling.';
      return;
    }
    state.clientSecret = data.clientSecret;

    // First time: mount Stripe Elements
    if (!state.elements) {
      state.elements = state.stripe.elements({
        clientSecret: data.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#000000',
            colorBackground: '#faf8f3',
            colorText: '#000',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      });
      const paymentElContainer = document.getElementById('payment-element');
      paymentElContainer.innerHTML = '';
      state.paymentElement = state.elements.create('payment', { layout: 'tabs' });
      state.paymentElement.mount('#payment-element');
      document.getElementById('pay-btn').disabled = false;
    } else {
      // Refresh with new amount
      state.elements.fetchUpdates();
    }
    updatePayButton();
  } catch (err) {
    console.error(err);
    document.getElementById('pay-error').textContent = 'Netværksfejl. Prøv igen.';
  }
}

async function refreshPaymentIntent() {
  if (!state.clientSecret || !isCustomerComplete(collectCustomer())) return;
  await maybeInitPayment();
}

function updatePayButton() {
  const btn = document.getElementById('pay-btn');
  const totalKr = (calculateTotalOre() / 100).toFixed(2).replace('.', ',');
  btn.textContent = `Betal ${totalKr} kr.`;
}

// ─── Handle pay ───
async function handlePay() {
  const btn = document.getElementById('pay-btn');
  const errEl = document.getElementById('pay-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Behandler…';

  // Re-collect customer in case they edited fields after PI was created
  const customer = collectCustomer();
  if (!isCustomerComplete(customer)) {
    errEl.textContent = 'Udfyld venligst alle felter først.';
    btn.disabled = false;
    updatePayButton();
    return;
  }
  if (state.delivery === 'gls_pakkeshop' && !state.pakkeshop) {
    errEl.textContent = 'Vælg venligst en pakkeshop.';
    btn.disabled = false;
    updatePayButton();
    return;
  }
  state.customer = customer;

  // Tell Stripe to refresh the PaymentIntent with latest address before confirming.
  // We re-call our backend so the PI has the up-to-date shipping info attached server-side.
  try {
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.items,
        delivery: state.delivery,
        pakkeshop: state.pakkeshop,
        customer,
        amount: calculateTotalOre(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunne ikke opdatere betaling.');
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Fejl ved klargøring. Prøv igen.';
    btn.disabled = false;
    updatePayButton();
    return;
  }

  try {
    const { error } = await state.stripe.confirmPayment({
      elements: state.elements,
      confirmParams: {
        return_url: `${window.location.origin}/success.html`,
        receipt_email: state.customer.email,
      },
    });
    if (error) {
      errEl.textContent = error.message || 'Betaling mislykkedes.';
      btn.disabled = false;
      updatePayButton();
    }
    // Otherwise Stripe redirects to return_url on success
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Uventet fejl. Prøv igen.';
    btn.disabled = false;
    updatePayButton();
  }
}
