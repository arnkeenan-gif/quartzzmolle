// ============================================================
// QUARTZ MØLLE — MAIN JS
// ============================================================

// Load visitor tracker for admin dashboard analytics
(function loadTracker() {
  if (window.location.pathname.includes('/admin')) return;
  const s = document.createElement('script');
  s.src = 'js/track.js';
  s.async = true;
  document.head.appendChild(s);
})();

// ── MOBILE MENU ──
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    // If menu is currently open and user is closing it, reload the page
    // (bulletproof fix for iOS Safari render artifacts after fullscreen overlay).
    if (mobileMenu.classList.contains('open')) {
      window.location.reload();
      return;
    }
    mobileMenu.classList.add('open');
  });
  // When user clicks a link inside the mobile menu
  mobileMenu.querySelectorAll('a').forEach(el => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      if (!href) return;

      // Anchor link on same page - close menu and smoothly scroll to target
      if (href.startsWith('#')) {
        e.preventDefault();
        mobileMenu.classList.remove('open');
        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          // Wait for the menu close animation to finish before scrolling
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
        return;
      }

      // Anchor on different page (e.g. "index.html#kontakt") - navigate normally
      // All other links: just close menu, let default behavior happen
      mobileMenu.classList.remove('open');
    });
  });
  mobileMenu.querySelectorAll('button').forEach(el => {
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
        // Force a scroll event so video-fade logic refreshes (otherwise the
        // bottom mask state can get stuck after closing the modal)
        window.dispatchEvent(new Event('scroll'));
      }
      return;
    }
    // Click on backdrop (not on content)
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('open');
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('scroll'));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => {
        m.classList.remove('open');
      });
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('scroll'));
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

  // Header (logo, language switch, cart, burger) FADES away when you scroll down
  // and FADES back in when you scroll up. Smooth opacity only (no sliding).
  const navEl = document.getElementById('nav') || document.querySelector('.nav');
  if (navEl) navEl.style.transition = 'opacity .45s ease';
  let lastY = window.scrollY || window.pageYOffset || 0;
  let navHidden = false;
  const showNav = () => { navEl.style.opacity = '1'; navEl.style.pointerEvents = ''; navHidden = false; };
  const hideNav = () => { navEl.style.opacity = '0'; navEl.style.pointerEvents = 'none'; navHidden = true; };
  const updateNav = () => {
    if (!navEl) return;
    const y = window.scrollY || window.pageYOffset || 0;
    const delta = y - lastY;
    if (y <= 40) { showNav(); lastY = y; return; }   // always visible near the top
    if (Math.abs(delta) < 6) return;                  // ignore tiny jitter
    if (delta > 0 && !navHidden) hideNav();           // scrolling down → fade out
    else if (delta < 0 && navHidden) showNav();       // scrolling up   → fade in
    lastY = y;
  };

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

    updateNav();
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
    const w = (p.weights && p.weights[0]) || {};
    const img = p.previewImage || w.image || '';
    const price = w.price;
    const badgeHTML = p.badge === 'bestseller'
      ? `<span class="product-card-badge badge-bestseller">Bestseller</span>`
      : '';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    const safeImg = /^(https?:\/\/|\/|images\/)/i.test(String(img)) ? img : '';
    return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card">
        <img src="${esc(safeImg)}" alt="${esc(p.name + ' ' + p.type)}" class="product-card-img" loading="lazy" />
        <div class="product-card-body">
          ${badgeHTML}
          <div class="product-card-name">${esc(p.name)}</div>
          <div class="product-card-sub">${esc(p.type)}</div>
          <div class="product-card-price">Fra ${esc(price)},00 kr.</div>
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

// ── VIDEO SECTION VISIBILITY ──
// Adds .in-view to a video section when it's at least ~35% on screen, so
// the text-block fades in only once the section is properly visible (avoids
// text peeking at the bottom of the screen on mobile while scrolling).
function initVideoSectionVisibility() {
  const sections = document.querySelectorAll('.video-section');
  if (!sections.length || typeof IntersectionObserver === 'undefined') {
    sections.forEach(s => s.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.intersectionRatio >= 0.35) {
        entry.target.classList.add('in-view');
      } else if (entry.intersectionRatio < 0.05) {
        entry.target.classList.remove('in-view');
      }
    });
  }, { threshold: [0, 0.05, 0.35, 0.6, 1] });
  sections.forEach(s => io.observe(s));
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initModals();
  initVideoFade();
  initVideoSectionVisibility();
  renderHighlights();
});

// Re-fire scroll on pageshow so when user returns to this page (e.g. via back button
// from /om.html) the video-fade state and bottom-mask refresh correctly.
// We previously reloaded on bfcache restore but that created redirect loops with
// Vercel cleanUrls. Now we only refresh scroll state.
window.addEventListener('pageshow', () => {
  window.dispatchEvent(new Event('scroll'));
});
