// ── HALLOWEEN-SÆSON ─────────────────────────────────────────────────────────
// Sætter klassen .hw på <html> inden for et datointerval. ALT det sæsonbestemte
// i style.css hænger på den klasse, så pynten både tænder OG slukker sig selv.
// Uden en slutdato bliver den slags stående til langt ind i december, fordi
// ingen husker at pille den ned igen.
(function () {
  var FRA_MD = [9, 15];   // 15. oktober  (getMonth() er 0-indekseret)
  var TIL_MD = [10, 2];   // 2. november, til og med
  function iSaeson(d) {
    var m = d.getMonth(), dag = d.getDate();
    if (m === FRA_MD[0]) return dag >= FRA_MD[1];
    if (m === TIL_MD[0]) return dag <= TIL_MD[1];
    return false;
  }
  try {
    if (iSaeson(new Date())) document.documentElement.classList.add('hw');
  } catch (e) { /* pynt er aldrig vigtigere end at siden virker */ }
})();

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

  // Navigationen scroller væk med siden; "til toppen"-pilen styres af
  // initTilToppen() (kører på alle sider undtagen produktsiden).

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

    // Kører det scroll-drevne CSS-crossfade (index.html), rører JS ikke
    // opacity: de to ville ellers trække i hver sin retning. Falder CSS-
    // pinningen igennem, fjernes klassen igen, og JS tager over.
    const cssFade = document.documentElement.classList.contains('qm-css-fade');
    if (cssFade) {
      document.body.classList.toggle('past-videos', !anyVideoVisible);
      return;
    }

    if (closest && closest !== activeSection) {
      const idx = sections.indexOf(closest);
      sections.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        const vid = s.querySelector('.video-bg');
        // Overlayet er delt i to halvdele på forsiden (se index.html) — begge
        // skal følges ad, derfor querySelectorAll.
        const ovs = s.querySelectorAll('.video-overlay');
        // Earlier videos stay visible UNDER the active one (later sections sit
        // on top in stacking order). If the incoming video hasn't finished
        // loading yet, the previous video shows through instead of black.
        if (vid) vid.style.opacity = i <= idx ? '1' : '0';
        ovs.forEach(ov => { ov.style.opacity = i === idx ? '1' : '0'; });
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
  // Når index.html opgiver CSS-fadet, skal JS skrive opacity med det samme -
  // ikke først ved næste sektionsskift.
  window.addEventListener('qm:fade-fallback', () => { activeSection = null; update(); });
  update();
}

// ── TIL TOPPEN ──────────────────────────────────────────────────────────────
// Navigationen (logo, kurv, sprog, menu) bliver stående øverst og scroller væk
// med siden — den følger ikke med. På mobil dukker i stedet en lille hvid pil
// op i øverste venstre hjørne, når man er scrollet ned; et tryk fører helt op.
// Ikke på produktsiden: dér bliver navigationen stående fast (blå bjælke),
// fordi kurv-ikonet er det, der viser, at en vare er lagt i kurven.
function initTilToppen() {
  if (document.getElementById('productInner') || /\/product(\.html)?$/.test(location.pathname)) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'to-top';
  btn.setAttribute('aria-label', 'Til toppen');
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  document.body.appendChild(btn);
  const mobil = window.matchMedia('(max-width: 768px)');
  let vist = false, ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || window.pageYOffset || 0;
    // Vis pilen, når navigationen (72 px) for længst er scrollet væk — 300 px,
    // så den også kommer på korte sider som forhandlerkortet.
    const vis = mobil.matches && y > 300;
    if (vis !== vist) { vist = vis; btn.classList.toggle('show', vis); }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  btn.addEventListener('click', () => {
    const roligt = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: roligt ? 'auto' : 'smooth' });
  });
  update();
}

// ── FOOTER ──────────────────────────────────────────────────────────────────
// 1) Helt i bund: klassen qm-bund på <html> gør sidens baggrundsfarve grøn som
//    bakken i maleriet, så iPhone ikke viser en sort stribe under footeren.
// 2) PC: gardin-effekten i CSS skal kende footerens højde (højst skærmens højde).
function initFooter() {
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const root = document.documentElement;
  let bund = false, ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight || root.clientHeight;
    const b = footer.getBoundingClientRect().bottom <= vh + 60;
    if (b !== bund) { bund = b; root.classList.toggle('qm-bund', b); }
  };
  const maal = () => {
    const h = Math.min(footer.offsetHeight, root.clientHeight || window.innerHeight);
    footer.style.setProperty('--qm-gardin', Math.round(h) + 'px');
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', () => { maal(); update(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { maal(); update(); }).observe(footer);
  maal();
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
  initTilToppen();
  initFooter();
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

// ── FOTO-GALLERI ────────────────────────────────────────────────────────────
// Skjuler en flise, hvis billedet mangler (fx endnu ikke uploadet), og hele
// sektionen, hvis der er under to billeder tilbage. Så kan galleriet ligge
// klar i koden, uden at siden viser brudte billeder.
(function () {
  function prune(section) {
    var items = section.querySelectorAll('.pg-item');
    var alive = 0, pending = items.length;
    if (!pending) { section.style.display = 'none'; return; }

    function settle() {
      if (--pending > 0) return;
      if (alive < 2) { section.style.display = 'none'; return; }
      // Mangler det store billede, forfremmes det første tilbageværende
      if (!section.querySelector('.pg-item.pg-big')) {
        var first = section.querySelector('.pg-item');
        if (first) first.classList.add('pg-big');
      }
    }

    Array.prototype.forEach.call(items, function (item) {
      var img = item.querySelector('img');
      if (!img) { item.remove(); settle(); return; }
      if (img.complete) {
        if (img.naturalWidth > 0) { alive++; } else { item.remove(); }
        settle();
      } else {
        img.addEventListener('load', function () { alive++; settle(); }, { once: true });
        img.addEventListener('error', function () { item.remove(); settle(); }, { once: true });
      }
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.photo-gallery'), prune);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
