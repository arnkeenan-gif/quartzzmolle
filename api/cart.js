// ============================================================
// QUARTZ MØLLE — CART
// Cart state in localStorage, drawer UI, nav icon with count
// ============================================================

const CART_KEY = 'quartzmolle_cart_v1';

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {}
  updateCartUI();
  schedulePrefetch();
  reportCartState();
}

function cartCount() {
  return readCart().reduce((sum, it) => sum + it.qty, 0);
}

function cartTotal() {
  return readCart().reduce((sum, it) => sum + it.price * it.qty, 0);
}

// Add or increment (same productId + weightLabel merges into one line)
function addToCart(item) {
  const items = readCart();
  const qtyToAdd = Math.max(1, parseInt(item.qty, 10) || 1);
  const key = `${item.productId}|${item.weightLabel}`;
  const existing = items.find(it => `${it.productId}|${it.weightLabel}` === key);
  if (existing) {
    existing.qty += qtyToAdd;
  } else {
    items.push({ ...item, qty: qtyToAdd });
  }
  writeCart(items);
}

function removeFromCart(productId, weightLabel) {
  const items = readCart().filter(it =>
    !(it.productId === productId && it.weightLabel === weightLabel)
  );
  writeCart(items);
}

function changeQty(productId, weightLabel, delta) {
  const items = readCart();
  const it = items.find(i => i.productId === productId && i.weightLabel === weightLabel);
  if (!it) return;
  it.qty += delta;
  if (it.qty < 1) {
    removeFromCart(productId, weightLabel);
    return;
  }
  writeCart(items);
}

function clearCart() {
  writeCart([]);
}

// ── UI ──
function injectCartUI() {
  // Add cart icon to every .nav (next to burger on mobile, before .nav-cta on desktop)
  document.querySelectorAll('.nav').forEach(nav => {
    if (nav.querySelector('.cart-btn')) return; // don't inject twice
    const btn = document.createElement('button');
    btn.className = 'cart-btn';
    btn.setAttribute('aria-label', 'Kurv');
    btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <span class="cart-count" data-cart-count>0</span>
    `;
    btn.addEventListener('click', openCart);
    // Insert the cart before the Shop Nu button (desktop) so cart + Shop Nu sit together.
    // If nav-cta isn't present (or hidden), fall back to before burger.
    const cta = nav.querySelector('.nav-cta');
    const burger = nav.querySelector('.nav-burger');
    if (cta) {
      nav.insertBefore(btn, cta);
    } else if (burger) {
      nav.insertBefore(btn, burger);
    } else {
      nav.appendChild(btn);
    }
  });

  // Also inject to mobile-menu for easy access when menu is open
  document.querySelectorAll('.mobile-menu').forEach(menu => {
    if (menu.querySelector('.mobile-cart-link')) return;
  });

  // Drawer
  if (!document.getElementById('cart-drawer')) {
    const drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.className = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-backdrop" data-cart-close></div>
      <aside class="cart-panel" role="dialog" aria-label="Cart">
        <header class="cart-head">
          <div class="cart-head-titles">
            <h2>Din kurv</h2>
            <p class="cart-head-sub" id="cart-head-sub" hidden></p>
          </div>
          <button class="cart-close" data-cart-close aria-label="Luk">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>
        <div class="cart-items" id="cart-items"></div>
        <footer class="cart-foot">
          <div class="cart-total-row">
            <span>I alt</span>
            <span id="cart-total">0,00 kr.</span>
          </div>
          <p class="cart-shipnote">Fragt beregnes ved checkout</p>
          <p id="cart-weight-note" class="cart-weight-note" hidden></p>
          <p id="cart-error" class="cart-error"></p>
          <button class="btn-buy cart-cta" id="cart-checkout-btn">Til kassen</button>
          <button id="cart-continue-btn" class="cart-continue">Shop videre</button>
          <p class="cart-secure-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Sikker betaling med Stripe
          </p>
        </footer>
      </aside>
    `;
    document.body.appendChild(drawer);

    drawer.querySelectorAll('[data-cart-close]').forEach(el => {
      el.addEventListener('click', closeCart);
    });
    document.getElementById('cart-checkout-btn').addEventListener('click', checkoutCart);
    document.getElementById('cart-continue-btn').addEventListener('click', () => {
      // Continue shopping: go to the shop (or just close the cart if already there)
      if (window.location.pathname.includes('shop')) {
        closeCart();
      } else {
        window.location.href = 'shop.html';
      }
    });
  }

  updateCartUI();
}

let _prevCartCount = -1;
function updateCartUI() {
  const items = readCart();
  const count = items.reduce((s, i) => s + i.qty, 0);
  // Pop the badge only when the count actually goes up (not on first load).
  const bounce = _prevCartCount >= 0 && count > _prevCartCount;
  _prevCartCount = count;

  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.classList.toggle('has-items', count > 0);
    if (bounce) { el.classList.remove('qm-bounce'); void el.offsetWidth; el.classList.add('qm-bounce'); }
  });

  const headSub = document.getElementById('cart-head-sub');
  if (headSub) {
    headSub.hidden = count === 0;
    headSub.textContent = `${count} ${count === 1 ? 'vare' : 'varer'}`;
  }

  const list = document.getElementById('cart-items');
  if (list) {
    if (items.length === 0) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <p>Din kurv er tom.</p>
          <a class="cart-empty-btn" href="shop.html">Se alle produkter</a>
        </div>`;
    } else {
      list.innerHTML = items.map(it => `
        <div class="cart-item" data-pid="${it.productId}" data-wl="${it.weightLabel}">
          <img src="${it.image}" alt="${it.productName}" />
          <div class="cart-item-info">
            <div class="cart-item-top">
              <div class="cart-item-name">${it.productName}</div>
              <button class="cart-item-remove" aria-label="Remove">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            <div class="cart-item-sub">${it.productType} &middot; ${it.weightLabel}</div>
            <div class="cart-item-bottom">
              <div class="qty-pill">
                <button class="qty-btn" data-qty="-1" aria-label="Mindre">−</button>
                <span class="qty-val">${it.qty}</span>
                <button class="qty-btn" data-qty="1" aria-label="Mere">+</button>
              </div>
              <div class="cart-item-price">${(it.price * it.qty).toFixed(2).replace('.', ',')} kr.</div>
            </div>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.cart-item').forEach(row => {
        const pid = row.dataset.pid;
        const wl = row.dataset.wl;
        row.querySelectorAll('.qty-btn').forEach(b => {
          b.addEventListener('click', () => changeQty(pid, wl, parseInt(b.dataset.qty, 10)));
        });
        row.querySelector('.cart-item-remove').addEventListener('click', () => removeFromCart(pid, wl));
      });
    }
  }

  const total = document.getElementById('cart-total');
  if (total) {
    total.textContent = `${cartTotal().toFixed(2).replace('.', ',')} kr.`;
  }

  // Heads-up BEFORE Stripe: orders above GLS' 25 kg limit can only be collected
  // (Click & Collect), so Stripe will preselect it as the only shipping method.
  // Explain that here in the cart so it never confuses anyone on the payment page.
  const note = document.getElementById('cart-weight-note');
  if (note) {
    const totalKg = items.reduce((sum, it) => {
      const m = String(it.weightLabel || '').match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      return sum + (m ? parseFloat(m[1].replace(',', '.')) : 0) * (it.qty || 1);
    }, 0);
    if (totalKg > 25) {
      const kgTxt = String(Math.round(totalKg * 10) / 10).replace('.', ',');
      const en = (function () { try { return localStorage.getItem('qm_lang') === 'en'; } catch (e) { return false; } })();
      note.innerHTML = en
        ? `Your order weighs <strong>${kgTxt} kg</strong> — above GLS' 25 kg shipping limit. It can therefore only be collected with <strong>free Click &amp; Collect</strong> at the mill (Suså Landevej 101), which is preselected at checkout.`
        : `Din ordre vejer <strong>${kgTxt} kg</strong> — over GLS' grænse på 25 kg for levering. Den kan derfor kun afhentes med <strong>gratis Click &amp; Collect</strong> på møllen (Suså Landevej 101), som er valgt på forhånd i checkout.`;
      note.hidden = false;
    } else {
      note.hidden = true;
      note.innerHTML = '';
    }
  }
}

function openCart() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  prefetchCheckout();
}

function closeCart() {
  // Reload the page when cart is closed. Bulletproof against iOS Safari
  // render artifacts (e.g. text bleeding through the bottom-mask).
  window.location.reload();
}

// Full-screen Quartz spinner shown while Stripe is being prepared (same as the
// confirmation page). Stays up through the redirect to Stripe.
function showCheckoutLoader() {
  let el = document.getElementById('qm-checkout-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'qm-checkout-loader';
    el.innerHTML = '<img src="images/logopng.png" alt="Quartz Mølle" />';
    document.body.appendChild(el);
  }
  void el.offsetWidth;
  el.classList.add('show');
}
function hideCheckoutLoader() {
  const el = document.getElementById('qm-checkout-loader');
  if (el) el.classList.remove('show');
}

// If the visitor presses BACK from Stripe, the browser restores the page from
// its back/forward cache exactly as it looked — i.e. with the loader still
// covering everything. Always hide the loader (and re-arm the checkout button)
// when the page is shown again, so back never lands on a stuck loading screen.
window.addEventListener('pageshow', () => {
  hideCheckoutLoader();
  const btn = document.getElementById('cart-checkout-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Til kassen'; }
  // A back/forward restore shows the page as an old snapshot — its cart badge
  // and drawer reflect the cart as it WAS. Re-read localStorage so the cart
  // always shows the current contents.
  _prevCartCount = -1; // don't bounce the badge over a restore
  updateCartUI();
  _pf = { key: '', url: '', ts: 0, inflight: null }; // brugt/forældet — forbered forfra
});



// ── KUNDEREJSE-SIGNAL: anonymt "i kurv" / "i checkout" til admin-tragten ─────
// Sender kun et tilfældigt id + antal varer + total — aldrig navne eller andet
// personligt. Bruges til "Lige nu i butikken"-panelet i admin.
function qmVid() {
  try {
    let v = localStorage.getItem('qm_vid');
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('qm_vid', v);
    }
    return v;
  } catch (e) { return 'anon'; }
}

function sendFunnel(step, items) {
  const payload = JSON.stringify({
    action: step === 'checkout' ? 'checkoutstart' : 'cart',
    id: qmVid(),
    count: items.reduce((s, i) => s + (i.qty || 0), 0),
    total: Math.round(items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0)),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/log-visit', new Blob([payload], { type: 'application/json' }));
      return;
    }
  } catch (e) {}
  try {
    fetch('/api/log-visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  } catch (e) {}
}

let _funnelTimer = null;
function reportCartState() {
  clearTimeout(_funnelTimer);
  _funnelTimer = setTimeout(() => sendFunnel('cart', readCart()), 1500);
}

// ── LYN-CHECKOUT: forbered Stripe-sessionen i baggrunden ─────────────────────
// Når kurven åbnes (og når indholdet ændres, mens den er åben), oprettes
// checkout-sessionen hos Stripe i forvejen — kunden mærker intet. Trykket på
// "Til kassen" kan så sende direkte afsted uden ventetid. Falder altid
// tilbage til den normale vej, hvis forberedelsen ikke er klar eller fejlede.
const PREFETCH_TTL_MS = 25 * 60 * 1000;
let _pf = { key: '', url: '', ts: 0, inflight: null };
let _pfTimer = null;

function cartKey(items) {
  return items.map(it => `${it.productId}|${it.weightLabel}|${it.qty}`).join(';');
}

function prefetchCheckout() {
  const items = readCart();
  if (!items.length) { _pf = { key: '', url: '', ts: 0, inflight: null }; return; }
  const key = cartKey(items);
  if (_pf.key === key && _pf.url && Date.now() - _pf.ts < PREFETCH_TTL_MS) return;
  if (_pf.key === key && _pf.inflight) return;
  const inflight = fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  }).then(r => (r.ok ? r.json() : null)).then(d => {
    if (_pf.inflight === inflight) {
      _pf = { key, url: (d && d.url) || '', ts: Date.now(), inflight: null };
    }
  }).catch(() => {
    if (_pf.inflight === inflight) _pf = { key: '', url: '', ts: 0, inflight: null };
  });
  _pf = { key, url: '', ts: 0, inflight };
}

function schedulePrefetch() {
  clearTimeout(_pfTimer);
  _pfTimer = setTimeout(() => {
    const drawer = document.getElementById('cart-drawer');
    if (drawer && drawer.classList.contains('open')) prefetchCheckout();
  }, 600);
}

async function checkoutCart() {
  const items = readCart();
  if (items.length === 0) return;
  sendFunnel('checkout', items);
  const btn = document.getElementById('cart-checkout-btn');
  const errEl = document.getElementById('cart-error');
  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Forbereder…'; }
  showCheckoutLoader();

  // Forberedt i baggrunden? → afsted med det samme (0 ventetid)
  const key = cartKey(items);
  if (_pf.key === key) {
    if (_pf.inflight) { try { await _pf.inflight; } catch (e) { /* falder tilbage */ } }
    if (_pf.key === key && _pf.url && Date.now() - _pf.ts < PREFETCH_TTL_MS) {
      window.location.href = _pf.url;
      return;
    }
  }

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON response */ }

    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }

    const msg = data.error || `Kunne ikke åbne betaling (status ${res.status}). Prøv igen.`;
    console.error('Checkout failed:', res.status, data);
    hideCheckoutLoader();
    if (errEl) errEl.textContent = msg;
    if (btn) { btn.disabled = false; btn.textContent = "Til kassen"; }
    // If the drawer isn't open (e.g. "Køb nu"), open it so the error is visible.
    if (typeof openCart === 'function') openCart();
  } catch (err) {
    console.error(err);
    hideCheckoutLoader();
    if (errEl) errEl.textContent = 'Netværksfejl — tjek forbindelse og prøv igen.';
    if (btn) { btn.disabled = false; btn.textContent = 'Til kassen'; }
    if (typeof openCart === 'function') openCart();
  }
}

// Expose globals for product.js
window.QuartzCart = {
  add: addToCart,
  open: openCart,
  close: closeCart,
  count: cartCount,
  checkout: checkoutCart,
};

document.addEventListener('DOMContentLoaded', injectCartUI);
