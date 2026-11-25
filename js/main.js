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
  // JUL: 1. december til og med 31. december → klassen .jul (julepynt og sne
  // på shop- og produktsiderne, se "JUL" sidst i style.css). Slukker selv 1. januar.
  function iJul(d) {
    return d.getMonth() === 11;   // getMonth() er 0-indekseret: 11 = december
  }
  try {
    var nu = new Date();
    if (iSaeson(nu)) document.documentElement.classList.add('hw');
    if (iJul(nu)) document.documentElement.classList.add('jul');
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
// 2) Gardin-effekten i CSS skal kende footerens højde (højst skærmens højde).
function initFooter() {
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const root = document.documentElement;
  let bund = false, ticking = false;
  const update = () => {
    ticking = false;
    // Grøn bund allerede halvanden skærm før bunden (og kun på sidens nederste
    // halvdel, så toppen på korte sider forbliver sort). Så er farven skiftet
    // længe før man ser den, også når man scroller hurtigt ned.
    const vh = window.innerHeight || root.clientHeight;
    const y = window.scrollY || root.scrollTop || 0;
    const max = root.scrollHeight - vh;
    const tilBund = Math.max(0, max - y);
    // Kan siden slet ikke scrolles (fx en høj skærm), ses footeren hele tiden.
    const b = max <= 1 ? footer.getBoundingClientRect().bottom <= vh + 60
                       : tilBund < Math.min(vh * 1.5, y);
    if (b !== bund) { bund = b; root.classList.toggle('qm-bund', b); }
    if (b) topFarve();
  };
  // Usynlig bjælke i toppen (se .qm-top-tint i style.css): Safari farver
  // feltet bag uret med dens farve i stedet for den grønne sidefarve.
  let tint = document.querySelector('.qm-top-tint');
  if (!tint) {
    tint = document.createElement('div');
    tint.className = 'qm-top-tint';
    tint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tint);
  }
  let sidsteFarve = '';
  const topFarve = () => {
    // farven på det indhold der ligger lige under uret (første ikke-gennemsigtige baggrund)
    let el = document.elementFromPoint(window.innerWidth / 2, 60);
    let farve = '';
    while (el && el !== root) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) { farve = c; break; }
      el = el.parentElement;
    }
    farve = farve || '#faf7f2';
    if (farve !== sidsteFarve) { sidsteFarve = farve; tint.style.backgroundColor = farve; }
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

// ── NYHEDSBREV I FOOTEREN ────────────────────────────────────────────────────
// Et e-mailfelt i footeren på alle sider. Bruger den samme tilmelding som den
// gamle popup: /api/log-visit med usynlig bot-verifikation (en lille regne-
// opgave i baggrunden) og velkomstmail med 10%-koden. Er man allerede tilmeldt
// på denne enhed, vises feltet ikke.
function initNyhedsbrev() {
  const inner = document.querySelector('.footer .footer-inner');
  if (!inner || document.getElementById('footerNl')) return;
  try { if (localStorage.getItem('qm_nl_sub') === '1') return; } catch (e) {}
  let en = false;
  try { en = localStorage.getItem('qm_lang') === 'en'; } catch (e) {}
  const T = en ? {
    label: 'Newsletter', sub: 'Sign up and get 10% off your next order',
    ph: 'Your email address', btn: 'Sign up', busy: 'Signing up…',
    invalid: 'Please enter a valid email address.',
    already: 'You are already subscribed — check your inbox for the code.',
    thanks: 'Thanks! Check your inbox — your 10% discount code is on its way.',
    senere: 'We could not sign you up right now — please try again later.',
    fail: 'Something went wrong. Please try again.', net: 'Network error — please try again.'
  } : {
    label: 'Nyhedsbrev', sub: 'Tilmeld dig og få 10% på din næste ordre',
    ph: 'Din e-mailadresse', btn: 'Tilmeld', busy: 'Tilmelder…',
    invalid: 'Skriv en gyldig e-mailadresse.',
    already: 'Du er allerede tilmeldt — tjek din indbakke for koden.',
    thanks: 'Tak! Tjek din indbakke — din 10%-rabatkode er på vej.',
    senere: 'Vi kunne ikke tilmelde dig lige nu — prøv igen senere.',
    fail: 'Noget gik galt. Prøv igen.', net: 'Netværksfejl — prøv igen.'
  };

  const form = document.createElement('form');
  form.id = 'footerNl';
  form.className = 'footer-nl';
  form.noValidate = true;
  form.innerHTML =
    '<label class="footer-nl-tekst" for="footerNlEmail"><strong></strong><span></span></label>' +
    '<div class="footer-nl-felt">' +
      '<input type="email" id="footerNlEmail" name="email" autocomplete="email" inputmode="email" required />' +
      // Honningkrukke: usynligt felt. Udfyldt = bot (serveren svarer pænt og gør intet).
      '<input type="text" id="footerNlWebsite" name="website" class="footer-nl-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
      '<button type="submit"></button>' +
    '</div>' +
    '<div class="footer-nl-msg" role="status" aria-live="polite"></div>';
  const input = form.querySelector('#footerNlEmail');
  const hp = form.querySelector('#footerNlWebsite');
  const btn = form.querySelector('button');
  const msg = form.querySelector('.footer-nl-msg');
  form.querySelector('.footer-nl-tekst strong').textContent = T.label;
  form.querySelector('.footer-nl-tekst span').textContent = T.sub;
  input.placeholder = T.ph;
  input.setAttribute('aria-label', T.ph);
  btn.textContent = T.btn;
  inner.appendChild(form);
  // Filerne lægges op én ad gangen: kender style.css ikke feltet endnu, vises
  // det ikke (ellers ville det stå ustylet i footeren et øjeblik).
  if (getComputedStyle(hp).position !== 'absolute') { form.remove(); return; }
  inner.classList.add('har-nl');

  // Hent en engangs-udfordring og løs den (~1/2 sekund, usynligt for kunden).
  async function loes() {
    const cr = await fetch('/api/log-visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nlchallenge' }),
    });
    const cd = await cr.json().catch(() => ({}));
    if (!cd.ok || !cd.ch) return null;
    const udstedt = Date.now();
    const enc = new TextEncoder();
    const maal = cd.bits || 15;
    const nulBits = (u8) => {
      let bits = 0;
      for (let i = 0; i < u8.length; i++) {
        const b = u8[i];
        if (b === 0) { bits += 8; continue; }
        for (let m = 128; m > 0; m >>= 1) { if (b & m) return bits; bits++; }
        return bits;
      }
      return bits;
    };
    for (let nonce = 0; nonce < 4000000; nonce++) {
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(cd.ch + ':' + nonce));
      if (nulBits(new Uint8Array(buf)) >= maal) {
        // Serveren kræver, at udfordringen er mindst 2 sek. gammel (mennesketempo).
        const vent = 2400 - (Date.now() - udstedt);
        if (vent > 0) await new Promise((r) => setTimeout(r, vent));
        return { ch: cd.ch, nonce: String(nonce) };
      }
      if ((nonce & 511) === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return null;
  }
  function send(email, pow) {
    return fetch('/api/log-visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'newsletter', email: email, lang: en ? 'en' : 'da',
        website: hp.value || '', ch: pow ? pow.ch : '', nonce: pow ? pow.nonce : '',
      }),
    });
  }

  // PC med gardin-footer: går man ind i feltet med Tab-tasten, mens footeren
  // stadig er dækket af siden ovenover, rulles der lige præcis så langt ned, at
  // gardinet er helt åbent og feltet kan ses. Kun når gardin-effekten faktisk
  // kører — ellers sørger browseren selv for at vise feltet, og siden må ikke hoppe.
  form.addEventListener('focusin', () => {
    const footer = form.closest('.footer');
    if (!footer || getComputedStyle(inner).animationName !== 'qm-gardin') return;
    const r = footer.getBoundingClientRect();
    if (r.bottom > window.innerHeight + 1 && r.top > 1) {
      const root = document.documentElement;
      window.scrollTo({ top: Math.min(window.scrollY + r.top, root.scrollHeight - window.innerHeight), behavior: 'instant' });
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    const email = (input.value || '').trim();
    msg.className = 'footer-nl-msg';
    msg.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.classList.add('err'); msg.textContent = T.invalid; return;
    }
    btn.disabled = true; btn.textContent = T.busy;
    try {
      let pow = await loes();
      let r = await send(email, pow);
      let d = await r.json().catch(() => ({}));
      // Udløbet bevis (fx efter lang tid i feltet): prøv én gang til, automatisk.
      if (!r.ok && d && d.retry) {
        pow = await loes();
        r = await send(email, pow);
        d = await r.json().catch(() => ({}));
      }
      if (r.ok && d.ok && (d.stored || d.already)) {
        // Serveren gemte tilmeldingen (eller kunden var allerede tilmeldt).
        // Så vises feltet ikke igen på denne enhed.
        msg.textContent = d.already ? T.already : T.thanks;
        input.value = '';
        try { localStorage.setItem('qm_nl_sub', '1'); } catch (err) {}
        form.classList.add('er-tilmeldt');
      } else if (r.ok && d.ok) {
        // Serveren svarede pænt, men gemte ikke noget (for mange tilmeldinger
        // fra samme sted i dag). Lov ikke en kode, der ikke kommer.
        msg.classList.add('err'); msg.textContent = T.senere;
      } else {
        msg.classList.add('err'); msg.textContent = (!en && d.error) || T.fail;
      }
    } catch (err) {
      msg.classList.add('err'); msg.textContent = T.net;
    }
    btn.disabled = false; btn.textContent = T.btn;
  });
}

// ── JULELEVERINGER 2026: stribe øverst + "Læs mere" ──────────────────────────
// En tynd stribe øverst på hovedsiderne med nyheden om juleleveringer. "Læs mere"
// åbner hele teksten. Man kan bestille hele julen — striben skifter bare tekst,
// når fristen for levering inden jul er gået (lørdag 19/12 kl. 00.00): herefter
// står der, at bestillinger sendes fra 4. januar. Mandag 4/1-2027 forsvinder
// striben helt. De to tidspunkter er de samme som i js/cart.js.
function initJulestribe() {
  const FERIE_FRA = Date.UTC(2026, 11, 18, 23, 0, 0); // = 19/12-2026 kl. 00.00 dansk tid
  const FERIE_TIL = Date.UTC(2027, 0, 3, 23, 0, 0);   // =  4/1-2027  kl. 00.00 dansk tid
  const nav = document.querySelector('.nav');
  const nu = Date.now();
  if (!nav || nu >= FERIE_TIL || document.getElementById('qm-stribe')) return;
  // Ikke på bekræftelsessiden efter et køb, og ikke på produktsiderne — kun på
  // hovedsiderne (forside, shop, forhandlere, om os, vores korn).
  if (document.querySelector('.success-page, .product-hero-band')) return;
  const fase = nu >= FERIE_FRA ? 'ferie' : 'frist';
  // Har kunden lukket striben, vises den først igen, når teksten skifter.
  try { if (localStorage.getItem('qm_jul_stribe') === fase) return; } catch (e) {}
  let en = false;
  try { en = localStorage.getItem('qm_lang') === 'en'; } catch (e) {}
  const root = document.documentElement;

  const T = en ? {
    navn: 'Christmas deliveries', mere: 'Read more', luk: 'Close',
    frist: ['Christmas deliveries:', 'order by Friday 18 Dec for delivery before Christmas', 'order by Fri 18 Dec'],
    ferie: ['Christmas deliveries:', 'orders placed now will be sent from Monday 4 January', 'orders sent from 4 Jan'],
    titel: 'Christmas deliveries',
    intro: 'Christmas is approaching fast and we’re running on full power at the mill to ensure that we can keep you baking during this busy season! As part of our planning, we would like to share the delivery days with you. From previous experience, any deliveries scheduled between Christmas and New Year do not happen due to substitute drivers, sickness, holidays etc. So to reduce the risk of flour stranded in some terminal or getting lost we have decided on the following dates.',
    datoer: [
      ['Last orders for delivery before Christmas', 'Friday 18/12'],
      ['Last sending from the mill', 'Monday 21/12'],
    ],
    ingen: 'There will not be any orders sent from the mill from 22/12 until 04/01/2027.',
    tilbage: 'We will return to normal on Monday 04/01/2027.',
    hilsen: 'Happy Christmas and New Year!',
  } : {
    navn: 'Juleleveringer', mere: 'Læs mere', luk: 'Luk',
    frist: ['Juleleveringer:', 'bestil senest fredag d. 18/12 for levering inden jul', 'bestil senest fre. 18/12'],
    ferie: ['Juleleveringer:', 'bestillinger afgivet nu sendes fra mandag d. 4. januar', 'ordrer sendes fra 4/1'],
    titel: 'Juleleveringer',
    intro: 'Julen nærmer sig med hastige skridt, og vi kører for fuld kraft på møllen, så I kan blive ved med at bage i den travle tid! Som en del af vores planlægning vil vi gerne dele leveringsdagene med jer. Vi ved af erfaring, at leveringer mellem jul og nytår ofte ikke bliver til noget på grund af afløserchauffører, sygdom, ferie osv. For at mindske risikoen for, at melet strander på en terminal eller bliver væk undervejs, har vi valgt følgende datoer.',
    datoer: [
      ['Sidste frist for bestilling, hvis I vil have levering inden jul', 'Fredag d. 18/12'],
      ['Sidste afsendelse fra møllen', 'Mandag d. 21/12'],
    ],
    ingen: 'Vi sender ingen ordrer fra møllen fra d. 22/12 og frem til d. 4/1/2027.',
    tilbage: 'Mandag d. 4/1/2027 er vi tilbage som normalt.',
    hilsen: 'Glædelig jul og godt nytår!',
  };

  const el = (tag, cls, tekst) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (tekst != null) n.textContent = tekst;
    return n;
  };

  // ── Striben ──
  const stribe = el('div', 'qm-stribe');
  stribe.id = 'qm-stribe';
  stribe.setAttribute('role', 'region');
  stribe.setAttribute('aria-label', T.navn);
  const tekst = el('p', 'qm-stribe-tekst');
  tekst.appendChild(el('strong', '', T[fase][0]));
  tekst.appendChild(document.createTextNode(' '));
  tekst.appendChild(el('span', 'qm-stribe-lang', T[fase][1]));
  tekst.appendChild(el('span', 'qm-stribe-kort', T[fase][2]));
  const mere = el('button', 'qm-stribe-mere', T.mere);
  mere.type = 'button';
  const kryds = el('button', 'qm-stribe-luk', '×');
  kryds.type = 'button';
  kryds.setAttribute('aria-label', T.luk);
  stribe.appendChild(tekst);
  stribe.appendChild(mere);
  stribe.appendChild(kryds);
  document.body.insertBefore(stribe, document.body.firstChild);
  // Filerne lægges op én ad gangen: kender style.css ikke striben endnu, vises
  // den ikke (ellers ville den stå ustylet oven i menuen et øjeblik).
  if (getComputedStyle(stribe).position !== 'absolute') { stribe.remove(); return; }
  root.classList.add('qm-har-stribe');

  // Stribens højde styrer, hvor langt menuen og sidernes top rykkes ned.
  const maal = () => root.style.setProperty('--qm-stribe-h', stribe.offsetHeight + 'px');
  maal();
  window.addEventListener('resize', maal);
  if ('ResizeObserver' in window) new ResizeObserver(maal).observe(stribe);

  kryds.addEventListener('click', () => {
    try { localStorage.setItem('qm_jul_stribe', fase); } catch (e) {}
    window.removeEventListener('resize', maal);
    stribe.remove();
    root.classList.remove('qm-har-stribe');
    root.style.removeProperty('--qm-stribe-h');
  });

  // ── "Læs mere": hele teksten i et vindue ──
  let modal = null, sidstFokus = null;
  // Forsidens "Vores korn"-popup åbner af sig selv efter 5 sek. for nye
  // besøgende. Sker det, mens jule-vinduet er åbent, holdes den tilbage og
  // vises først, når jule-vinduet lukkes — ellers lå den skjult bagved og
  // tog tastaturfokus.
  const korn = document.getElementById('nlModal');
  let kornVenter = false;
  if (korn && 'MutationObserver' in window) {
    new MutationObserver(() => {
      if (modal && modal.classList.contains('open') && korn.classList.contains('open')) {
        korn.classList.remove('open');
        kornVenter = true;
        document.body.style.overflow = 'hidden';
      }
    }).observe(korn, { attributes: true, attributeFilter: ['class'] });
  }
  const lukModal = () => {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (kornVenter && korn) {
      kornVenter = false;
      korn.classList.add('open');
      document.body.style.overflow = 'hidden';
      return;
    }
    try { if (sidstFokus && sidstFokus.focus) sidstFokus.focus({ preventScroll: true }); } catch (e) {}
  };
  const bygModal = () => {
    modal = el('div', 'qm-jul-modal');
    modal.id = 'qm-jul-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'qm-jul-titel');
    const bag = el('div', 'qm-jul-bag');
    const kort = el('div', 'qm-jul-kort');
    kort.tabIndex = -1;
    const x = el('button', 'qm-jul-kryds', '×');
    x.type = 'button';
    x.setAttribute('aria-label', T.luk);
    const h = el('h2', '', T.titel);
    h.id = 'qm-jul-titel';
    const dl = el('dl', 'qm-jul-datoer');
    T.datoer.forEach((d) => {
      const r = el('div');
      r.appendChild(el('dt', '', d[0]));
      r.appendChild(el('dd', '', d[1]));
      dl.appendChild(r);
    });
    const p2 = el('p');
    p2.appendChild(el('strong', '', T.ingen));
    p2.appendChild(document.createTextNode(' ' + T.tilbage));
    const ok = el('button', 'qm-jul-ok', T.luk);
    ok.type = 'button';
    [x, h, el('p', '', T.intro), dl, p2, el('p', 'qm-jul-hilsen', T.hilsen), ok].forEach((n) => kort.appendChild(n));
    modal.appendChild(bag);
    modal.appendChild(kort);
    document.body.appendChild(modal);
    [bag, x, ok].forEach((n) => n.addEventListener('click', lukModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lukModal(); });
    // Tastaturfokus bliver i vinduet, mens det er åbent.
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const a = document.activeElement;
      if (e.shiftKey && (a === x || a === kort)) { e.preventDefault(); ok.focus(); }
      else if (!e.shiftKey && a === ok) { e.preventDefault(); x.focus(); }
    });
  };
  mere.addEventListener('click', () => {
    if (!modal) bygModal();
    sidstFokus = document.activeElement;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const kort = modal.querySelector('.qm-jul-kort');
    kort.scrollTop = 0;
    setTimeout(() => { try { kort.focus({ preventScroll: true }); } catch (e) {} }, 50);
  });
}

// ── JULESNE: snefnug der falder i det blå bånd ──────────────────────────────
// Kun på shop- og produktsiderne, og kun når juletemaet er tændt (klassen .jul
// på <html>, 1/12–31/12). Fnuggene ligger BAG teksten og kan ikke trykkes på.
// Har man bedt om mindre bevægelse på sin enhed, vises der ingen sne.
function initJulesne() {
  if (!document.documentElement.classList.contains('jul')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const baand = document.querySelector('.shop-hero, .product-hero-band');
  if (!baand || baand.querySelector('.jul-sne')) return;
  const lag = document.createElement('div');
  lag.className = 'jul-sne';
  lag.setAttribute('aria-hidden', 'true');
  const tilf = (a, b) => a + Math.random() * (b - a);
  const antal = window.innerWidth < 760 ? 14 : 26;
  for (let i = 0; i < antal; i++) {
    // Alle fnug er rigtige snefnug (seks arme) — ingen prikker. De små får en
    // enklere, kraftigere tegning, så de stadig ligner snefnug i lille størrelse.
    const str = i % 4 === 0 ? tilf(16, 22) : tilf(9, 15);
    const fnug = document.createElement('span');
    fnug.className = 'jul-fnug' + (str < 13 ? ' jul-fnug-enkel' : '');
    fnug.appendChild(document.createElement('i'));
    fnug.style.left = tilf(0, 100).toFixed(2) + '%';
    fnug.style.opacity = tilf(0.5, 0.95).toFixed(2);
    fnug.style.setProperty('--str', str.toFixed(1) + 'px');
    fnug.style.setProperty('--tid', tilf(9, 19).toFixed(1) + 's');        // faldtid
    fnug.style.setProperty('--start', (-tilf(0, 19)).toFixed(1) + 's');   // så sneen er i gang med det samme
    fnug.style.setProperty('--svaj', tilf(6, 22).toFixed(0) + 'px');
    fnug.style.setProperty('--svajtid', tilf(2.5, 5.5).toFixed(1) + 's');
    fnug.style.setProperty('--drej', tilf(-40, 40).toFixed(0) + 'deg');   // fnuggene vipper lidt, mens de falder
    lag.appendChild(fnug);
  }
  baand.appendChild(lag);
  // Filerne lægges op én ad gangen: kender style.css ikke sneen endnu, vises den ikke.
  if (getComputedStyle(lag).position !== 'absolute') { lag.remove(); return; }
  // Faldhøjden følger båndets højde.
  const maal = () => lag.style.setProperty('--fald', (baand.offsetHeight + 48) + 'px');
  maal();
  window.addEventListener('resize', maal);
  if ('ResizeObserver' in window) new ResizeObserver(maal).observe(baand);
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
  initNyhedsbrev();
  initJulestribe();
  initJulesne();
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
