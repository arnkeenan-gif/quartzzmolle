// ============================================================
// QUARTZ MØLLE — SHOP PAGE
// ============================================================

const SUPABASE_URL = 'https://eqmxgfuhbtsouoprtgix.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbXhnZnVoYnRzb3VvcHJ0Z2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjE2MTcsImV4cCI6MjA5MTk5NzYxN30.ZdAsVKYLhDVgSbcd4otO6PP2CT7Wd4ob0yBu-JHTxaU';

// Full catalog currently loaded (local data, later merged with Supabase).
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
    // Use branded preview image for cards — avoids the 3kg vs 12,5kg confusion
    const img = p.previewImage || p.weights[0].image;
    const price = p.weights[0].price;
    const badgeHTML = p.badge === 'bestseller'
      ? `<span class="product-card-badge badge-bestseller">Bestseller</span>`
      : '';

    return `
      <a href="product.html?id=${p.id}" class="product-card">
        <img src="${img}" alt="${p.name} ${p.type}" class="product-card-img" loading="lazy" />
        <div class="product-card-body">
          ${badgeHTML}
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-sub">${p.type}</div>
          <div class="product-card-price">Fra ${price},00 kr.</div>
        </div>
      </a>
    `;
  }).join('');
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

async function loadShopProducts() {
  SHOP_PRODUCTS = [...PRODUCTS];
  applySearch();

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const dbProducts = await res.json();
      if (dbProducts && dbProducts.length > 0) {
        const merged = [...PRODUCTS];
        dbProducts.forEach(dbP => {
          const idx = merged.findIndex(lp => lp.id === dbP.id);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...dbP };
          else merged.push(dbP);
        });
        SHOP_PRODUCTS = merged;
        applySearch();
      }
    }
  } catch (e) {
    console.log('Using local product data');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initShopSearch();
  loadShopProducts();
});
