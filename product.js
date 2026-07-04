// ============================================================
// QUARTZ MØLLE — PRODUCT PAGE
// ============================================================

const STRIPE_PK = 'pk_live_51L5wKqCCp2Usx7QSCdRAk3JMWtoKxZcrRi0V99qHiPsRQHQC9h5q4ZZmzjSdDqliSIUVEvKD60sB54tuaKw9VZfr00HLho5fWW';
let stripe;
try { stripe = Stripe(STRIPE_PK); } catch(e) { console.warn('Stripe not loaded'); }

let selectedWeightIndex = -1;   // -1 means no size chosen yet → show preview image
let currentProduct = null;

// Escape any product-derived value before putting it in innerHTML. Product data
// can be merged from Supabase, so it must be treated as untrusted (prevents XSS).
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function safeUrl(u) {
  u = String(u || '');
  return /^(https?:\/\/|\/|images\/)/i.test(u) ? u : '';
}

function getBadgeHTML(badge) {
  // Intentionally no bestseller badge on the product page itself
  // (cards in shop/bestsellers still show it, just not the full product page)
  return '';
}

// ── Fragt Regler content (same for every product) ──
function fragtReglerHTML() {
  return `
    <p><strong>GLS</strong> Levering til pakkeshop i Danmark – <strong>max 20 kg</strong></p>
    <p><strong>GLS</strong> Levering til privatadresse i Danmark – <strong>max 25 kg</strong></p>
    <p>Bemærk: Du kan <strong>ikke bestille 2 stk. 12,5 kg melposer</strong> i samme ordre. Vores 12,5 kg poser indeholder altid lidt mere mel end angivet, så to af dem vejer omkring <strong>25,2 kg</strong> – hvilket overskrider GLS' grænse på 25 kg.</p>
  `;
}

// ── Næringsindhold table (per product) ──
function nutritionTableHTML(n) {
  if (!n) return '<p style="color:#888;font-size:0.9rem">Næringsindhold er ikke tilgængelig for dette produkt.</p>';
  return `
    <table class="nutrition-table">
      <caption>Næringsindhold pr. 100 g</caption>
      <tbody>
        <tr><th>Energi</th><td>${esc(n.energy || '—')}</td></tr>
        <tr><th>Fedt</th><td>${esc(n.fat || '—')}</td></tr>
        <tr class="indent"><th>heraf mættede fedtsyrer</th><td>${esc(n.saturated || '—')}</td></tr>
        <tr><th>Kulhydrat</th><td>${esc(n.carbs || '—')}</td></tr>
        <tr class="indent"><th>heraf sukkerarter</th><td>${esc(n.sugars || '—')}</td></tr>
        <tr><th>Kostfibre</th><td>${esc(n.fiber || '—')}</td></tr>
        <tr><th>Protein</th><td>${esc(n.protein || '—')}</td></tr>
        <tr><th>Salt</th><td>${esc(n.salt || '—')}</td></tr>
      </tbody>
    </table>
  `;
}

function renderProduct(product) {
  currentProduct = product;
  const inner = document.getElementById('productInner');
  document.title = `${product.name} – ${product.type} | Quartz Mølle`;

  // Show the REAL certification logos (EU organic leaf + red Statskontrolleret
  // økologisk mark) instead of text pills. The EU logo already carries the
  // "DK-ØKO-100 / EU-jordbrug" text, so no extra pills are needed.
  const certsArr = product.certifications || [];
  const hasEU = certsArr.some(c => /eu|øko/i.test(String(c)));
  const hasStats = certsArr.some(c => /stats/i.test(String(c)));
  let certsHTML = '';
  if (hasEU) certsHTML += `<img src="images/eu-organic.jpg" alt="EU Økologi – DK-ØKO-100" loading="lazy" style="height:46px;width:auto;border-radius:6px;display:block" />`;
  if (hasStats) certsHTML += `<img src="images/statskontrolleret.png" alt="Statskontrolleret Økologisk" loading="lazy" style="height:46px;width:auto;border-radius:6px;display:block;background:#fff" />`;
  if (!certsHTML) certsHTML = certsArr.map(c => `<span class="cert-tag">${esc(c)}</span>`).join('');

  // No weight selected yet → show branded preview image + lowest price
  const defaultImage = product.previewImage || product.weights[0].image;
  const defaultPrice = product.weights[0].price;

  const weightBtns = product.weights.map((wt, i) => `
    <button class="weight-btn" data-weight-index="${i}">
      ${esc(wt.label)}
    </button>
  `).join('');

  inner.innerHTML = `
    <div>
      <a href="shop.html" class="btn-back">← Tilbage til shop</a>
      <img src="${esc(safeUrl(defaultImage))}" alt="${esc(product.name)}"
           class="product-page-img" id="productImg" />
    </div>
    <div class="product-page-info">
      ${getBadgeHTML(product.badge)}
      <h1 class="product-page-name">${esc(product.name)}</h1>
      <p class="product-page-type">${esc(product.type)}</p>
      <p class="product-page-desc">${esc(product.description)}</p>

      <div class="weight-selector">
        <h3>Vælg størrelse</h3>
        <div class="weight-options">${weightBtns}</div>
      </div>

      <div class="product-price-display" id="priceDisplay">
        Fra ${defaultPrice},00 kr.
      </div>

      <div class="qty-selector">
        <span class="qty-label">Antal</span>
        <div class="qty-stepper">
          <button class="qty-btn" id="qtyMinus" type="button" aria-label="Mindre">−</button>
          <input class="qty-input" id="qtyInput" type="number" min="1" max="99" value="1" inputmode="numeric" />
          <button class="qty-btn" id="qtyPlus" type="button" aria-label="Mere">+</button>
        </div>
      </div>

      <button class="btn-buy" id="buyBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        Tilføj til kurv
      </button>

      <div class="certifications">${certsHTML}</div>

      <p style="font-size:0.82rem;color:#999;line-height:1.6;margin-top:0.25rem">
        ${esc(product.origin)}<br>
        Fragt beregnes ved checkout &middot; Sikker betaling via Stripe
      </p>

      <div class="accordion">
        <div class="accordion-item">
          <button class="accordion-header" type="button">
            Fragt regler
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">${fragtReglerHTML()}</div>
          </div>
        </div>
        <div class="accordion-item">
          <button class="accordion-header" type="button">
            Næringsindhold
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">${nutritionTableHTML(product.nutrition)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up size buttons
  inner.querySelectorAll('.weight-btn').forEach(btn => {
    btn.addEventListener('click', () => selectWeight(parseInt(btn.dataset.weightIndex, 10)));
  });
  document.getElementById('buyBtn').addEventListener('click', handleBuy);

  // Wire up quantity stepper
  const qtyInput = document.getElementById('qtyInput');
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  function clampQty() {
    let n = parseInt(qtyInput.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 99) n = 99;
    qtyInput.value = n;
  }
  qtyMinus.addEventListener('click', () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  });
  qtyPlus.addEventListener('click', () => {
    qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
  });
  qtyInput.addEventListener('change', clampQty);
  qtyInput.addEventListener('blur', clampQty);
}

function selectWeight(index) {
  if (!currentProduct) return;
  selectedWeightIndex = index;
  const w = currentProduct.weights[index];

  // Fade-swap the image to the actual pack shot
  const img = document.getElementById('productImg');
  if (img) {
    img.style.transition = 'opacity 0.25s';
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = w.image;
      img.alt = `${currentProduct.name} ${currentProduct.type} ${w.label}`;
      img.style.opacity = '1';
    }, 200);
  }

  const price = document.getElementById('priceDisplay');
  if (price) price.textContent = `${w.price},00 kr.`;

  document.querySelectorAll('.weight-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
}

async function handleBuy() {
  if (!currentProduct) return;

  if (selectedWeightIndex < 0) {
    // Gently flash the size selector instead of a toast
    const sel = document.querySelector('.weight-selector');
    if (sel) {
      sel.classList.add('needs-attention');
      setTimeout(() => sel.classList.remove('needs-attention'), 1200);
    }
    return;
  }

  const w = currentProduct.weights[selectedWeightIndex];
  const qtyEl = document.getElementById('qtyInput');
  const qty = Math.max(1, Math.min(99, parseInt(qtyEl?.value, 10) || 1));

  if (window.QuartzCart) {
    window.QuartzCart.add({
      productId: currentProduct.id,
      productName: currentProduct.name,
      productType: currentProduct.type,
      weightLabel: w.label,
      price: w.price,
      image: w.image,
      qty: qty,
    });
    window.QuartzCart.open();
  }
}

// ── FORESLÅEDE PRODUKTER ──
// Viser op til 4 andre produkter på hver produktside. Vi prioriterer
// andre kornsorter end den viste (så listen ikke kun er størrelsesvarianter)
// og lader bestsellers komme først.
function renderSuggested(product) {
  const section = document.getElementById('suggested');
  const grid = document.getElementById('suggestedGrid');
  if (!section || !grid || typeof PRODUCTS === 'undefined') return;

  const others = PRODUCTS.filter(p => p.id !== product.id);
  const sorted = others.slice().sort((a, b) => {
    const diffName = (a.name === product.name) - (b.name === product.name);
    if (diffName !== 0) return diffName; // andre sorter først
    return (b.badge === 'bestseller') - (a.badge === 'bestseller'); // bestsellers først
  });
  const picks = sorted.slice(0, 4);
  if (!picks.length) return;

  grid.innerHTML = picks.map(p => {
    const w = (p.weights && p.weights[0]) || {};
    const img = p.previewImage || w.image || '';
    const price = w.price;
    const badgeHTML = p.badge === 'bestseller'
      ? `<span class="product-card-badge badge-bestseller">Bestseller</span>`
      : '';
    return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card">
        <img src="${esc(safeUrl(img))}" alt="${esc(p.name + ' ' + p.type)}" class="product-card-img" loading="lazy" />
        <div class="product-card-body">
          ${badgeHTML}
          <div class="product-card-name">${esc(p.name)}</div>
          <div class="product-card-sub">${esc(p.type)}</div>
          <div class="product-card-price">Fra ${esc(price)},00 kr.</div>
        </div>
      </a>
    `;
  }).join('');

  section.hidden = false;
}

function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = 'shop.html'; return; }
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) { window.location.href = 'shop.html'; return; }
  renderProduct(product);
  renderSuggested(product);
}

document.addEventListener('DOMContentLoaded', loadProduct);
