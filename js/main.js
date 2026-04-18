// ============================================================
// QUARTZ MØLLE — MAIN JS
// ============================================================

// ── MOBILE MENU ──
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ── MODAL HANDLING ──
// Any element with [data-open-modal="X"] will open the modal with id "modal-X".
// Close via the .modal-close button, Escape key, or clicking the backdrop.
function initModals() {
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-modal]');
    if (opener) {
      e.preventDefault();
      const id = opener.dataset.openModal;
      const modal = document.getElementById('modal-' + id);
      if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
      return;
    }
    const closer = e.target.closest('.modal-close');
    if (closer) {
      const modal = closer.closest('.modal-backdrop');
      if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
      return;
    }
    // Click on backdrop (not on content)
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => {
        m.classList.remove('open');
      });
      document.body.style.overflow = '';
    }
  });
}

// ── SMOOTH VIDEO CROSSFADE ──
function initVideoFade() {
  const sections = Array.from(document.querySelectorAll('.video-section'));
  if (!sections.length) return;

  sections.forEach(section => {
    const vid = section.querySelector('.video-bg');
    if (vid) {
      vid.muted = true;
      vid.playsInline = true;
      vid.play().catch(() => {});
    }
  });

  let activeSection = null;

  const update = () => {
    const viewportCenter = window.innerHeight / 2;
    let closest = null;
    let minDist = Infinity;
    let anyVideoVisible = false;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const dist = Math.abs(sectionCenter - viewportCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = section;
      }
      // Check if any part of this section is in the viewport
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        anyVideoVisible = true;
      }
    });

    if (closest && closest !== activeSection) {
      sections.forEach(s => s.classList.remove('is-active'));
      closest.classList.add('is-active');
      activeSection = closest;
    }

    // Toggle body class so CSS can hide the fixed videos when user is past the video sections
    document.body.classList.toggle('past-videos', !anyVideoVisible);
  };

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

// ── HOMEPAGE HIGHLIGHTS GRID ──
// Uses previewImage for the branded promo look (not the 3kg/12.5kg pack shots).
function renderHighlights() {
  const grid = document.getElementById('highlightsGrid');
  if (!grid || typeof BESTSELLERS === 'undefined') return;

  grid.innerHTML = BESTSELLERS.map(p => {
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

// ── TOAST NOTIFICATION (disabled — silent) ──
function showToast(msg, type = 'success') {
  // Toasts are disabled per request; errors go to console only.
  if (type === 'error') console.warn('[toast suppressed]:', msg);
}

// ── ACCORDION TOGGLE ──
// Delegated on document so dynamically rendered accordions (product page) work.
document.addEventListener('click', (e) => {
  const header = e.target.closest('.accordion-header');
  if (!header) return;
  const item = header.closest('.accordion-item');
  if (item) item.classList.toggle('open');
});

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initModals();
  initVideoFade();
  renderHighlights();
});
