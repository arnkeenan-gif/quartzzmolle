// ============================================================
// QUARTZ MØLLE — PRODUCT PAGE
// ============================================================

const STRIPE_PK = 'pk_live_51L5wKqCCp2Usx7QSCdRAk3JMWtoKxZcrRi0V99qHiPsRQHQC9h5q4ZZmzjSdDqliSIUVEvKD60sB54tuaKw9VZfr00HLho5fWW';
let stripe;
try { stripe = Stripe(STRIPE_PK); } catch(e) { console.warn('Stripe not loaded'); }

let selectedWeightIndex = -1;   // -1 means no size chosen yet → show preview image
let currentProduct = null;

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
    <p>Vores 12,5 kg melposer har altid mere mel i poserne – derfor kan vi ikke sende 2 stk. 12,5 kg med GLS på en 25 kg levering.</p>
    <p><strong>Danske Fragtmand</strong> Privatlevering – forudsætter, at der er <strong>nogen til stede til at modtage leveringen</strong>, eller at der på forhånd gives tydelige instruktioner om <strong>et sikkert sted, hvor pakken kan stilles</strong>. Hvis leveringen ikke kan modtages personligt, og der ikke er angivet et sikkert afleveringssted, <strong>vil forsendelsen blive sendt retur til møllen</strong>.</p>
  `;
}

// ── Næringsindhold table (per product) ──
function nutritionTableHTML(n) {
  if (!n) return '<p style="color:#888;font-size:0.9rem">Næringsindhold er ikke tilgængelig for dette produkt.</p>';
  return `
    <table class="nutrition-table">
      <caption>Næringsindhold pr. 100 g</caption>
      <tbody>
        <tr><th>Energi</th><td>${n.energy || '—'}</td></tr>
        <tr><th>Fedt</th><td>${n.fat || '—'}</td></tr>
        <tr class="indent"><th>heraf mættede fedtsyrer</th><td>${n.saturated || '—'}</td></tr>
        <tr><th>Kulhydrat</th><td>${n.carbs || '—'}</td></tr>
        <tr class="indent"><th>heraf sukkerarter</th><td>${n.sugars || '—'}</td></tr>
        <tr><th>Kostfibre</th><td>${n.fiber || '—'}</td></tr>
        <tr><th>Protein</th><td>${n.protein || '—'}</td></tr>
        <tr><th>Salt</th><td>${n.salt || '—'}</td></tr>
      </tbody>
    </table>
  `;
}

function renderProduct(product) {
  currentProduct = product;
  const inner = document.getElementById('productInner');
  document.title = `${product.name} – ${product.type} | Quartz Mølle`;

  const certsHTML = product.certifications.map(c =>
    `<span class="cert-tag">${c}</span>`
  ).join('');

  // No weight selected yet → show branded preview image + lowest price
  const defaultImage = product.previewImage || product.weights[0].image;
  const defaultPrice = product.weights[0].price;

  const weightBtns = product.weights.map((wt, i) => `
    <button class="weight-btn" data-weight-index="${i}">
      ${wt.label}
    </button>
  `).join('');

  inner.innerHTML = `
    <div>
      <a href="shop.html" class="btn-back">← Tilbage til shop</a>
      <img src="${defaultImage}" alt="${product.name}"
           class="product-page-img" id="productImg" />
    </div>
    <div class="product-page-info">
      ${getBadgeHTML(product.badge)}
      <h1 class="product-page-name">${product.name}</h1>
      <p class="product-page-type">${product.type}</p>
      <p class="product-page-desc">${product.description}</p>

      <div class="weight-selector">
        <h3>Vælg størrelse</h3>
        <div class="weight-options">${weightBtns}</div>
      </div>

      <div class="product-price-display" id="priceDisplay">
        Fra ${defaultPrice},00 kr.
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
        ${product.origin}<br>
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

  if (window.QuartzCart) {
    window.QuartzCart.add({
      productId: currentProduct.id,
      productName: currentProduct.name,
      productType: currentProduct.type,
      weightLabel: w.label,
      price: w.price,
      image: w.image,
    });
    window.QuartzCart.open();
  }
}

function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = 'shop.html'; return; }
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) { window.location.href = 'shop.html'; return; }
  renderProduct(product);
}

document.addEventListener('DOMContentLoaded', loadProduct);
