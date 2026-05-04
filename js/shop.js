// ============================================================
// QUARTZ MØLLE — SHOP PAGE
// ============================================================
const SUPABASE_URL = 'https://eqmxgfuhbtsouoprtgix.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbXhnZnVoYnRzb3VvcHJ0Z2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjE2MTcsImV4cCI6MjA5MTk5NzYxN30.ZdAsVKYLhDVgSbcd4otO6PP2CT7Wd4ob0yBu-JHTxaU';
function renderShopGrid(products) {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  if (!products || products.length === 0) {
    grid.innerHTML = '<div class="shop-loading">Ingen produkter fundet.</div>';
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
      <a href="/product?id=${p.id}" class="product-card">
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
async function loadShopProducts() {
  renderShopGrid(PRODUCTS);
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
        renderShopGrid(merged);
      }
    }
  } catch (e) {
    console.log('Using local product data');
  }
}
document.addEventListener('DOMContentLoaded', loadShopProducts);
