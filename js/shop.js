// ============================================================
// QUARTZ MØLLE — SHOP PAGE
// ============================================================

// Full catalog currently loaded (from the built-in product list in products.js).
// The search bar filters this list without re-fetching.
let SHOP_PRODUCTS = [];

function renderShopGrid(products) {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;

  if (!products || products.length === 0) {
    const q = (document.getElementById('shopSearch')?.value || '').trim();
    grid.innerHTML = q
      ? `<div class="shop-loading">Ingen produkter matcher “${escapeHTML(q)}”.</div>`
      : '<div class="shop-loading">Ingen produkter fundet.</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    // Use branded preview image for cards — avoids the 3kg vs 12,5kg confusion.
    // Guard weights defensively in case a merged Supabase row lacks them.
    const w = (p.weights && p.weights[0]) || {};
    const img = p.previewImage || w.image || '';
    const price = w.price;
    const badgeHTML = p.badge === 'bestseller'
      ? `<span class="product-card-badge badge-bestseller">Bestseller</span>`
      : '';

    return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card">
        <img src="${escapeHTML(safeUrl(img))}" alt="${escapeHTML(p.name + ' ' + p.type)}" class="product-card-img" loading="lazy" />
        <div class="product-card-body">
          ${badgeHTML}
          <div class="product-card-name">${escapeHTML(p.name)}</div>
          <div class="product-card-sub">${escapeHTML(p.type)}</div>
          <div class="product-card-price">Fra ${escapeHTML(price)},00 kr.</div>
        </div>
      </a>
    `;
  }).join('');
}

// Only allow http(s)/site-relative image URLs (blocks javascript: etc. in src).
function safeUrl(u) {
  u = String(u || '');
  return /^(https?:\/\/|\/|images\/)/i.test(u) ? u : '';
}

// ── PRODUKTSØGNING ──
// Escape brugerinput før det indsættes i innerHTML.
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Filtrér det aktuelle sortiment på navn, type og beskrivelse.
function filterProducts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return SHOP_PRODUCTS;
  return SHOP_PRODUCTS.filter(p => {
    const haystack = [p.name, p.type, p.description, p.badge]
      .filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function applySearch() {
  const input = document.getElementById('shopSearch');
  const clearBtn = document.getElementById('shopSearchClear');
  const query = input ? input.value : '';
  // Vis kun ryd-knappen når der reelt er søgt (ikke ved blanktegn alene).
  if (clearBtn) clearBtn.hidden = !query.trim();
  renderShopGrid(filterProducts(query));
}

function initShopSearch() {
  const input = document.getElementById('shopSearch');
  const clearBtn = document.getElementById('shopSearchClear');
  if (input) input.addEventListener('input', applySearch);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) { input.value = ''; input.focus(); }
      applySearch();
    });
  }
}

function loadShopProducts() {
  SHOP_PRODUCTS = [...PRODUCTS];
  applySearch();
}

document.addEventListener('DOMContentLoaded', () => {
  initShopSearch();
  loadShopProducts();
});
