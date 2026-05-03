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
  const key = `${item.productId}|${item.weightLabel}`;
  const existing = items.find(it => `${it.productId}|${it.weightLabel}` === key);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({ ...item, qty: 1 });
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
          <h2>Din kurv</h2>
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
          <p id="cart-error" class="cart-error"></p>
          <button class="btn-buy" id="cart-checkout-btn">Til kassen</button>
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
  }

  updateCartUI();
}

function updateCartUI() {
  const items = readCart();
  const count = items.reduce((s, i) => s + i.qty, 0);

  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.classList.toggle('has-items', count > 0);
  });

  const list = document.getElementById('cart-items');
  if (list) {
    if (items.length === 0) {
      list.innerHTML = `<p class="cart-empty">Din kurv er tom.</p>`;
    } else {
      list.innerHTML = items.map(it => `
        <div class="cart-item" data-pid="${it.productId}" data-wl="${it.weightLabel}">
          <img src="${it.image}" alt="${it.productName}" />
          <div class="cart-item-info">
            <div class="cart-item-name">${it.productName}</div>
            <div class="cart-item-sub">${it.productType} &middot; ${it.weightLabel}</div>
            <div class="cart-item-controls">
              <button class="qty-btn" data-qty="-1" aria-label="Decrease">−</button>
              <span class="qty-val">${it.qty}</span>
              <button class="qty-btn" data-qty="1" aria-label="Increase">+</button>
              <button class="cart-item-remove" aria-label="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="cart-item-price">${(it.price * it.qty).toFixed(2).replace('.', ',')} kr.</div>
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
}

function openCart() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
}

async function checkoutCart() {
  const items = readCart();
  if (items.length === 0) return;
  const btn = document.getElementById('cart-checkout-btn');
  const errEl = document.getElementById('cart-error');
  if (errEl) errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Forbereder…';
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
    if (errEl) errEl.textContent = msg;
    btn.disabled = false;
    btn.textContent = 'Til kassen';
  } catch (err) {
    console.error(err);
    if (errEl) errEl.textContent = 'Netværksfejl — tjek forbindelse og prøv igen.';
    btn.disabled = false;
    btn.textContent = 'Til kassen';
  }
}

// Expose globals for product.js
window.QuartzCart = {
  add: addToCart,
  open: openCart,
  close: closeCart,
  count: cartCount,
};

document.addEventListener('DOMContentLoaded', injectCartUI);
