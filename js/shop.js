// ============================================================
// QUARTZ MØLLE — SHOP PAGE
// ============================================================

// Full catalog currently loaded (from the built-in product list in products.js).
// The search bar filters this list without re-fetching.
let SHOP_PRODUCTS = [];

let SHOP_HAS_RENDERED = false;

function renderShopGrid(products) {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  // Efter første visning renderes kortene som allerede "afsløret", så søgning
  // og sortering ikke genafspiller entrance-animationen ved hvert tastetryk.
  const doneCls = SHOP_HAS_RENDERED ? ' qm-reveal qm-in' : '';

  if (!products || products.length === 0) {
    const q = (document.getElementById('shopSearch')?.value || '').trim();
    grid.innerHTML = q
      ? `<div class="shop-loading${doneCls}">Ingen produkter matcher “${escapeHTML(q)}”.</div>`
      : `<div class="shop-loading${doneCls}">Ingen produkter fundet.</div>`;
    SHOP_HAS_RENDERED = true;
    return;
  }

  grid.innerHTML = products.map((p, idx) => {
    // Use branded preview image for cards.
    // Guard weights defensively in case a merged Supabase row lacks them.
    const weights = (p.weights && p.weights.length) ? p.weights : [];
    const w = weights[0] || {};
    const img = p.previewImage || w.image || '';
    const price = w.price;

    // Show every available pack size as a chip so it's clear both the 3 kg
    // and the 12,5 kg (or 11 kg) bag exist. No bestseller badge in the shop.
    const sizesHTML = weights.length
      ? `<div class="product-card-sizes">${weights.map(wt =>
          `<span class="size-chip">${escapeHTML(wt.label)}</span>`).join('')}</div>`
      : '';

    return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card${doneCls}">
        <img src="${escapeHTML(safeUrl(img))}" alt="${escapeHTML(p.name + ' ' + p.type)}" class="product-card-img" loading="${idx < 4 ? 'eager' : 'lazy'}"${idx < 2 ? ' fetchpriority="high"' : ''} decoding="async" />
        <div class="product-card-body">
          <div class="product-card-name">${escapeHTML(p.name)}</div>
          <div class="product-card-sub">${escapeHTML(p.type)}</div>
          ${sizesHTML}
          <div class="product-card-price">Fra ${escapeHTML(price)},00 kr.</div>
        </div>
      </a>
    `;
  }).join('');
  SHOP_HAS_RENDERED = true;
}

// ── SORTERING ──
let SHOP_SORT = 'default';

function lowestPrice(p) {
  const ws = (p.weights || []).map(w => w.price).filter(n => typeof n === 'number');
  return ws.length ? Math.min(...ws) : Infinity;
}

// Flour-type classification from the product type text. The site has three:
// Fintsigtet (Type 70), Mellemsigtet (Type 85) and Fuldkorn (all "fuldkorn").
function isFintsigtet(p)   { return /fintsigtet/i.test(p.type || ''); }
function isMellemsigtet(p) { return /mellemsigtet/i.test(p.type || ''); }
function isFuldkorn(p)     { return /fuldkorn/i.test(p.type || ''); }

// Sort: bring the chosen flour type to the top, keeping catalogue order
// within each group (stable), so the shop reads as "grouped by type".
function bringToTop(arr, test) {
  return arr.slice().sort((a, b) => (test(b) ? 1 : 0) - (test(a) ? 1 : 0));
}

function sortProducts(list) {
  const arr = [...list];
  switch (SHOP_SORT) {
    case 'bestseller':
      return arr.sort((a, b) =>
        (b.badge === 'bestseller') - (a.badge === 'bestseller'));
    case 'fintsigtet':   return bringToTop(arr, isFintsigtet);
    case 'mellemsigtet': return bringToTop(arr, isMellemsigtet);
    case 'fuldkorn':     return bringToTop(arr, isFuldkorn);
    case 'price-asc':
      return arr.sort((a, b) => lowestPrice(a) - lowestPrice(b));
    case 'price-desc':
      return arr.sort((a, b) => lowestPrice(b) - lowestPrice(a));
    default:
      return arr; // catalogue order
  }
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
  renderShopGrid(sortProducts(filterProducts(query)));
}

function initShopSearch() {
  const input = document.getElementById('shopSearch');
  const clearBtn = document.getElementById('shopSearchClear');
  // ?q=… forudfylder søgefeltet. Det er den adresse, forsidens SearchAction
  // (sitelinks-søgefeltet i Google) sender folk hen til, så den SKAL virke.
  if (input) {
    try {
      const q = new URLSearchParams(location.search).get('q');
      if (q) input.value = q.slice(0, 80);
    } catch (e) { /* ingen søgning, ingen skade */ }
  }
  if (input) input.addEventListener('input', applySearch);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) { input.value = ''; input.focus(); }
      applySearch();
    });
  }
  const sort = document.getElementById('shopSort');
  if (sort) {
    try { SHOP_SORT = localStorage.getItem('qm_shop_sort') || 'default'; sort.value = SHOP_SORT; } catch (e) {}
    sort.addEventListener('change', () => {
      SHOP_SORT = sort.value;
      try { localStorage.setItem('qm_shop_sort', SHOP_SORT); } catch (e) {}
      applySearch();
    });
  }
}

function loadShopProducts() {
  SHOP_PRODUCTS = [...PRODUCTS];
  applySearch();
}

// Struktureret liste over sortimentet. Google kan læse butikssiden som en
// egentlig produktliste i stedet for bare en side med billeder — og listen
// bygges fra PRODUCTS, så den aldrig kommer ud af trit med butikken.
function injectShopItemList() {
  try {
    if (!Array.isArray(PRODUCTS) || !PRODUCTS.length) return;
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Alle produkter – Quartz Mølle',
      numberOfItems: PRODUCTS.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: PRODUCTS.map((p, i) => {
        const priser = (p.weights || []).map(w => w.price).filter(n => typeof n === 'number');
        const vare = {
          '@type': 'Product',
          name: `${p.name} – ${p.type}`,
          url: 'https://www.quartzmolle.dk/product?id=' + encodeURIComponent(p.id),
          sku: p.id
        };
        const bil = p.previewImage || (p.weights && p.weights[0] && p.weights[0].image);
        if (bil) vare.image = 'https://www.quartzmolle.dk/' + String(bil).replace(/^\//, '');
        if (priser.length) {
          vare.offers = {
            '@type': 'Offer',
            price: Math.min.apply(null, priser).toFixed(2),
            priceCurrency: 'DKK',
            availability: 'https://schema.org/InStock',
            url: vare.url
          };
        }
        return { '@type': 'ListItem', position: i + 1, item: vare };
      })
    };
    let el = document.getElementById('qm-shop-itemlist');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'qm-shop-itemlist'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data);
  } catch (e) { /* schema is best-effort */ }
}

document.addEventListener('DOMContentLoaded', () => {
  initShopSearch();
  loadShopProducts();
  injectShopItemList();
});
