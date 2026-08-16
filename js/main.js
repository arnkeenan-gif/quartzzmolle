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
      burger.setAttribute('aria-expanded', 'false');
      window.location.reload();
      return;
    }
    mobileMenu.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
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
        document.body.style.overflow = '';
        if (burger) burger.setAttribute('aria-expanded', 'false');
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
      document.body.style.overflow = '';
      if (burger) burger.setAttribute('aria-expanded', 'false');
    });
  });
  mobileMenu.querySelectorAll('button').forEach(el => {
    el.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
      if (burger) burger.setAttribute('aria-expanded', 'false');
    });
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

  // Header fade on scroll is handled globally by initNavFade() (runs on every
  // page, including the shop), so it isn't duplicated here.

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
      const idx = sections.indexOf(closest);
      sections.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        const vid = s.querySelector('.video-bg');
        const ov = s.querySelector('.video-overlay');
        // Earlier videos stay visible UNDER the active one (later sections sit
        // on top in stacking order). If the incoming video hasn't finished
        // loading yet, the previous video shows through instead of black.
        if (vid) vid.style.opacity = i <= idx ? '1' : '0';
        if (ov) ov.style.opacity = i === idx ? '1' : '0';
      });
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

// ── HEADER FADE ON SCROLL (every page) ──
// The header (logo, language switch, cart, burger) fades away when you scroll
// down and fades back in when you scroll up — smooth opacity only, no sliding.
// This used to live inside initVideoFade (homepage only); pulled out so the
// shop and every other page get the same behaviour.
function initNavFade() {
  // Not on the single product page — its header stays pinned (solid blue band).
  // #productInner is the static product-page container (present at load), and the
  // path check covers it even before/after product.js renders.
  if (document.getElementById('productInner') || /\/product(\.html)?$/.test(location.pathname)) return;
  const navEl = document.getElementById('nav') || document.querySelector('.nav');
  if (!navEl) return;
  navEl.style.transition = 'opacity .45s ease';
  let lastY = window.scrollY || window.pageYOffset || 0;
  let navHidden = false;
  const showNav = () => { navEl.style.opacity = '1'; navEl.style.pointerEvents = ''; navHidden = false; };
  const hideNav = () => { navEl.style.opacity = '0'; navEl.style.pointerEvents = 'none'; navHidden = true; };
  const updateNav = () => {
    if (mobileMenu && mobileMenu.classList.contains('open')) { showNav(); return; }
    const y = window.scrollY || window.pageYOffset || 0;
    const delta = y - lastY;
    if (y <= 40) { showNav(); lastY = y; return; }   // always visible near the top
    if (Math.abs(delta) < 6) return;                  // ignore tiny jitter
    if (delta > 0 && !navHidden) hideNav();           // scrolling down → fade out
    else if (delta < 0 && navHidden) showNav();       // scrolling up   → fade in
    lastY = y;
  };
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => { updateNav(); ticking = false; });
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateNav();
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
  if (!item) return;
  item.classList.toggle('open');
  header.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
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
  initNavFade();
  initVideoFade();
  initVideoSectionVisibility();
  renderHighlights();
});

// When the user returns via the back/forward button, iOS Safari restores the
// page from its bfcache with the video-pin transforms frozen mid-scroll, which
// looks glitchy on the homepage. On the homepage ONLY (where #videoStage lives)
// force one clean reload so the video background re-initialises from the top.
//
// This is guarded so it fires only on an actual back/forward restore, never on
// the fresh load that follows — after a reload the navigation type is 'reload'
// and event.persisted is false, so it can't loop (an unconditional reload was
// what previously looped with Vercel cleanUrls).
window.addEventListener('pageshow', (event) => {
  const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  const cameBack = event.persisted || (nav && nav.type === 'back_forward');
  if (cameBack && document.getElementById('videoStage')) {
    window.location.reload();
    return;
  }
  // On every other page just refresh scroll-driven state (video fade, bottom mask).
  window.dispatchEvent(new Event('scroll'));
});

// ── Scroll-reveal + staggered grids (progressive enhancement) ──
// Tagged elements fade/slide up when they enter the viewport. Grid children
// (shop / bestsellers / related) stagger in. Dynamically-rendered grids are
// handled via a MutationObserver. Fully skipped for reduced-motion users.
(function initReveal() {
  try {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('qm-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    function reveal(el, delayMs) {
      if (!el || el.nodeType !== 1 || el.classList.contains('qm-reveal')) return;
      el.classList.add('qm-reveal');
      if (delayMs) el.style.transitionDelay = delayMs + 'ms';
      io.observe(el);
    }

    var STATIC = ['.highlights-header', '.why-inner', '.sortiment h2', '.sortiment .season-note',
      '.sortiment-lead', '.sortiment-img', '.contact-inner', '.forhandlere-map-wrap',
      '.om-content', '.suggested-header'];
    var GRIDS = ['.shop-grid', '.highlights-grid', '.suggested-grid'];

    function run() {
      STATIC.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) { reveal(el); });
      });
      GRIDS.forEach(function (gridSel) {
        document.querySelectorAll(gridSel).forEach(function (grid) {
          Array.prototype.forEach.call(grid.children, function (c, i) { reveal(c, Math.min(i, 6) * 40); });
          new MutationObserver(function (muts) {
            muts.forEach(function (m) {
              var i = 0;
              Array.prototype.forEach.call(m.addedNodes, function (n) {
                if (n.nodeType === 1) { reveal(n, Math.min(i, 6) * 40); i++; }
              });
            });
          }).observe(grid, { childList: true });
        });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } catch (e) { /* never break the page for an animation */ }
})();

// Add-to-cart feedback: a small copy of the product label drops straight down
// from above into the cart icon, and the cart shakes when it lands. No-op for
// reduced-motion users. Exposed for product.js (name kept for compatibility).
window.qmFlyToCart = function (srcEl) {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cart = document.querySelector('.cart-btn') || document.querySelector('[data-cart-count]');
    if (!cart) return;
    var t = cart.getBoundingClientRect();
    var size = 34;

    var drop;
    if (srcEl && srcEl.tagName === 'IMG' && srcEl.src) {
      drop = document.createElement('img');
      drop.src = srcEl.currentSrc || srcEl.src;
      drop.alt = '';
    } else {
      drop = document.createElement('div');
      drop.style.background = '#273071';
    }
    drop.className = 'qm-drop';
    drop.style.width = size + 'px';
    drop.style.height = size + 'px';
    drop.style.left = (t.left + t.width / 2 - size / 2) + 'px';
    drop.style.top = (t.top + t.height / 2 - size / 2) + 'px';
    document.body.appendChild(drop);

    // Shake the cart when the label lands (the fall takes ~0.43s of the anim).
    setTimeout(function () {
      cart.classList.remove('qm-cart-shake'); void cart.offsetWidth; cart.classList.add('qm-cart-shake');
    }, 430);
    setTimeout(function () { if (drop.parentNode) drop.parentNode.removeChild(drop); }, 800);
  } catch (e) {}
};

// ── Quick add: a small cart button on every product card ──
// Tapping it opens a size popover that scales out of the button; picking a
// size adds to the cart immediately (fly-to-cart + badge bounce) without
// opening the product page. Cards are matched to PRODUCTS via their link id.
// A11y: aria-haspopup/aria-expanded on the trigger, Escape closes and returns
// focus, arrow keys move between sizes, focus leaving the popup closes it.
// Outside taps dismiss via pointerdown — reliable on iOS Safari, where
// document-level "click" never fires for taps on non-interactive elements.
(function initQuickAdd() {
  try {
    var CART_SVG = '<span class="qa-ic" aria-hidden="true"><svg class="qa-ic-cart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/><line x1="13.5" y1="7.75" x2="13.5" y2="12.25"/><line x1="11.25" y1="10" x2="15.75" y2="10"/></svg></span>';
    var CHECK_SVG = '<span class="qa-ic" aria-hidden="true"><svg class="qa-ic-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
    var openPop = null;
    var openBtn = null;

    function products() { return (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS : []; }
    function t(s) { return (window.QuartzI18n && window.QuartzI18n.t) ? window.QuartzI18n.t(s) : s; }
    function reduceMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function closePop(refocus) {
      if (!openPop) return;
      var pop = openPop;
      var btn = openBtn;
      openPop = null;
      openBtn = null;
      if (btn) btn.setAttribute('aria-expanded', 'false');
      function remove() { if (pop.parentNode) pop.parentNode.removeChild(pop); }
      if (reduceMotion()) {
        remove();
      } else {
        pop.classList.remove('in');
        pop.classList.add('out'); // exits back toward the button (see .qa-pop.out)
        setTimeout(remove, 160);
      }
      if (refocus && btn) btn.focus();
    }

    // Outside tap: pointerdown closes instantly (and actually fires on iOS).
    // If the dismissing tap landed on the card that owns the popup, swallow the
    // click that follows so dismissing doesn't also navigate to the product page.
    document.addEventListener('pointerdown', function (e) {
      if (!openPop) return;
      if (openPop.contains(e.target)) return;
      if (openBtn && (e.target === openBtn || openBtn.contains(e.target))) return; // its own click toggles
      var card = openPop.__card;
      closePop();
      if (card && card.contains(e.target)) {
        var cleanup = function () { document.removeEventListener('click', swallow, true); };
        var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); cleanup(); };
        document.addEventListener('click', swallow, true);
        setTimeout(cleanup, 500);
      }
    }, true);

    // Fallback for browsers without pointer events (keeps the old behaviour).
    document.addEventListener('click', function () { if (openPop) closePop(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPop) closePop(true);
    });

    function confirmAdd(btn, card) {
      if (btn.__qaTimer) clearTimeout(btn.__qaTimer);
      btn.classList.remove('qa-added');
      btn.innerHTML = CHECK_SVG;
      void btn.offsetWidth; // restart the pulse + check-draw animations
      btn.classList.add('qa-added');

      var old = card.querySelector('.qa-note');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var note = document.createElement('span');
      note.className = 'qa-note';
      note.setAttribute('role', 'status'); // screen readers announce the confirmation
      note.textContent = t('Tilføjet');
      card.appendChild(note);
      requestAnimationFrame(function () { note.classList.add('in'); });

      btn.__qaTimer = setTimeout(function () {
        btn.__qaTimer = null;
        btn.classList.remove('qa-added');
        btn.innerHTML = CART_SVG;
        note.classList.remove('in');
        setTimeout(function () { if (note.parentNode) note.parentNode.removeChild(note); }, 220);
      }, 1500);
    }

    function showPop(card, p, btn, viaKeyboard) {
      var already = openPop && openPop.__card === card;
      closePop();
      if (already) return; // second tap on the same button just closes

      var pop = document.createElement('div');
      pop.className = 'qa-pop';
      pop.__card = card;
      pop.setAttribute('role', 'group');
      pop.setAttribute('aria-label', t('Vælg størrelse'));
      pop.innerHTML =
        '<div class="qa-pop-title">Vælg størrelse</div>' +
        p.weights.map(function (w, i) {
          return '<button type="button" class="qa-opt" data-i="' + i + '">' +
            '<span>' + w.label + '</span>' +
            '<span class="qa-opt-price">' + w.price + ' kr.</span>' +
            '</button>';
        }).join('');

      pop.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var b = e.target.closest('.qa-opt');
        if (!b || pop.__picked) return; // one pick per popup — no double adds
        var w = p.weights[parseInt(b.dataset.i, 10)];
        if (!w || !window.QuartzCart) return;
        pop.__picked = true;

        // Add immediately — the confirmation plays while the cart updates.
        window.QuartzCart.add({
          productId: p.id,
          productName: p.name,
          productType: p.type,
          weightLabel: w.label,
          price: w.price,
          image: w.image,
          qty: 1,
        });
        if (window.qmFlyToCart) window.qmFlyToCart(card.querySelector('.product-card-img'));

        // Let the tapped row show its picked state before the popup leaves.
        b.classList.add('qa-picked');
        var hadFocus = pop.contains(document.activeElement);
        setTimeout(function () {
          closePop();
          if (hadFocus) btn.focus();
          confirmAdd(btn, card);
        }, reduceMotion() ? 0 : 260);
      });

      pop.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        var opts = Array.prototype.slice.call(pop.querySelectorAll('.qa-opt'));
        if (!opts.length) return;
        var idx = opts.indexOf(document.activeElement);
        var next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
        if (next < 0) next = opts.length - 1;
        if (next >= opts.length) next = 0;
        opts[next].focus();
      });

      // Tabbing (or focus otherwise moving) out of the popup closes it.
      pop.addEventListener('focusout', function (e) {
        if (openPop === pop && e.relatedTarget && !pop.contains(e.relatedTarget) && e.relatedTarget !== btn) {
          closePop();
        }
      });

      card.appendChild(pop);
      requestAnimationFrame(function () { pop.classList.add('in'); });
      openPop = pop;
      openBtn = btn;
      btn.setAttribute('aria-expanded', 'true');
      if (viaKeyboard) {
        var first = pop.querySelector('.qa-opt');
        if (first) first.focus();
      }
    }

    function enhance(card) {
      if (!card || card.nodeType !== 1 || card.__qaDone) return;
      if (!card.classList || !card.classList.contains('product-card')) return;
      card.__qaDone = true;
      var m = (card.getAttribute('href') || '').match(/[?&]id=([^&]+)/);
      if (!m) return;
      var id = decodeURIComponent(m[1]);
      var p = null;
      for (var i = 0; i < products().length; i++) { if (products()[i].id === id) { p = products()[i]; break; } }
      if (!p || !p.weights || !p.weights.length) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-btn';
      btn.setAttribute('aria-label', 'Tilføj til kurv');
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = CART_SVG;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showPop(card, p, btn, e.detail === 0); // detail 0 = keyboard: move focus into the popup
      });
      card.appendChild(btn);
    }

    function scan(root) {
      (root.querySelectorAll ? root.querySelectorAll('.product-card') : []).forEach(enhance);
      if (root.classList && root.classList.contains('product-card')) enhance(root);
    }

    function run() {
      scan(document);
      new MutationObserver(function (muts) {
        muts.forEach(function (mu) {
          Array.prototype.forEach.call(mu.addedNodes, function (n) {
            if (n.nodeType === 1) scan(n);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } catch (e) { /* never break the page */ }
})();
