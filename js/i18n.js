// ============================================================
// QUARTZ MØLLE — I18N (Dansk / English)
// ------------------------------------------------------------
// Danish is the source language. When the visitor picks English we translate
// the DOM text nodes (and a few attributes) via the dictionary below, and keep
// translating dynamically-rendered content (cart, product cards, checkout, …)
// with a MutationObserver. A language dropdown is injected into every .nav.
//
// To add a missing string: add "Danish exact text": "English" to QM_DICT.
// ============================================================

(function () {
  'use strict';

  var LANG_KEY = 'qm_lang';
  function currentLang() {
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'da'; } catch (e) { return 'da'; }
  }
  function setLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang === 'en' ? 'en' : 'da'); } catch (e) {}
    // Reload so the page re-renders from the Danish source, then re-translates.
    window.location.reload();
  }

  // ── Danish → English dictionary (keyed on the exact, trimmed text node value) ──
  var QM_DICT = {
    // Navigation / shared
    "Hjem": "Home",
    "Forhandlere": "Stockists",
    "Om os": "About Us",
    "Kontakt": "Contact",
    "Shop Nu": "Shop Now",
    "EU Økologi": "EU Organic",
    "Statskontrolleret Økologisk": "State-Controlled Organic",
    "Smileyrapport – se vores kontrolrapport fra Fødevarestyrelsen": "Smiley report – see our inspection report from the Danish Veterinary and Food Administration",
    "Smiley­rapport": "Smiley report",

    // index.html
    "Quartz Mølle – Økologisk Mel fra Stenkværn": "Quartz Mølle – Organic Stone-Milled Flour",
    "Økologisk mel – malet på stenkværn i Danmark": "Organic flour – stone-milled in Denmark",
    "Se vores mel": "See our flour",
    "Vores historie": "Our story",
    "Fra mark til mel": "From field to flour",
    "Vi dyrker og maler vores korn på stenkværn i hjertet af Danmark. Hver pose mel bærer historien om jord, sol og omtanke.": "We grow and mill our grain on a stone mill in the heart of Denmark. Every bag of flour carries the story of soil, sun and care.",
    "Læs mere": "Read more",
    "Vores sortiment": "Our range",
    "9 varianter af enestående mel": "9 varieties of exceptional flour",
    "Varianterne skifter naturligvis efter sæsonen": "The varieties naturally change with the season",
    "Fra Dalarna til Purpurhvede – hvert mel har sin egen karakter, smag og bagningsegenskaber.": "From Dalarna to Purple Wheat – each flour has its own character, flavour and baking properties.",
    "Se alle produkter": "See all products",
    "Udvalgte produkter": "Selected products",
    "Se hele sortimentet": "See all products",
    "Hvorfor Quartz Mølle?": "Why Quartz Mølle?",
    "Mel med mening": "Flour with meaning",
    "Stenkværnet": "Stone-milled",
    "– Langsom formaling bevarer næringsstoffer og smag": "– Slow milling preserves nutrients and flavour",
    "Nordisk korn": "Nordic grain",
    "– Dyrket på nordisk jord med respekt for naturen": "– Grown in Nordic soil with respect for nature",
    "Certificeret økologisk": "Certified organic",
    "– EU-Øko & Statskontrolleret Økologisk": "– EU Organic & State-Controlled Organic",
    "Direkte fra mølle": "Direct from the mill",
    "– Ingen mellemmænd, frisk mel til dig": "– No middlemen, fresh flour delivered to you",
    "Find os": "Find us",
    "4160 Herlufmagle, Danmark": "4160 Herlufmagle, Denmark",

    // om.html
    "Om os – Quartz Mølle": "About Us – Quartz Mølle",
    "Quartz Mølle – Smag, Stabilitet og Stenmalet Kvalitet": "Quartz Mølle – Flavour, Consistency and Stone-Milled Quality",
    "Hos Quartz Mølle forener vi traditionelt håndværk med moderne indsigt i at fremstille noget af Danmarks mest smagfulde og stabile økologiske mel. Vi samarbejder med økologiske landmænd fra Danmark og Sverige og udvælger kun de bedste, mest næringsrige kornsorter, som vi maler nænsomt – og altid med fokus på smag, sundhed og bageevne.": "At Quartz Mølle, we combine traditional craftsmanship with modern insight to produce some of Denmark's most flavourful and consistent organic flour. We work with organic farmers in Denmark and Sweden and select only the finest, most nutritious grain varieties, which we mill gently – always with a focus on flavour, health and baking quality.",
    "Vores mølle er navngivet Quartz Mølle da vores møllesten er rige på kvarts, men også emery og flint – hårde stenarter, som sikrer en præcis, skånsom og stabil formaling. I stedet for at kværne kornet hårdt under høj temperatur, bevarer vi næringsstofferne ved at male langsomt: kun 115 omdrejninger i minuttet – mod de typiske 330 rpm i mange andre stenkværn.": "Our mill is named Quartz Mølle because our millstones are rich in quartz, but also emery and flint – hard minerals that ensure a precise, gentle and consistent grind. Instead of grinding the grain hard at high temperatures, we preserve the nutrients by milling slowly: just 115 revolutions per minute – compared with the typical 330 rpm of many other stone mills.",
    "Vi kombinerer vores skånsomme stenformaling med en dobbelt valsemølle fra 1949, som giver os en unik kontrol over struktur og konsistens. Det betyder mel med høj bagekvalitet, stor smag og en stabilitet, som professionelle bagere og passionerede hjemmebagere kan stole på – hver gang. Hos Quartz Mølle tror vi på gennemsigtighed, ærlighed og et kompromisløst fokus på kvalitet. Vi sætter en dyd i at levere det bedste, naturen og håndværket kan tilbyde.": "We combine our gentle stone milling with a double roller mill from 1949, which gives us unique control over texture and consistency. The result is flour with excellent baking quality, great flavour and a consistency that professional bakers and passionate home bakers can rely on – every time. At Quartz Mølle, we believe in transparency, honesty and an uncompromising focus on quality. We take pride in delivering the very best that nature and craftsmanship have to offer.",
    "Quartz Mølle stenkværn": "Quartz Mølle stone mill",

    // forhandlere.html
    "Forhandlere – Quartz Mølle": "Stockists – Quartz Mølle",
    "Find en Quartz Mølle forhandler i nærheden af dig.": "Find a Quartz Mølle stockist near you.",
    "Find en Quartz Mølle forhandler i nærheden af dig. Klik på et logo for at se butikkens hjemmeside.": "Find a Quartz Mølle stockist near you. Click a logo to visit the shop's website.",
    "Besøg hjemmeside →": "Visit website →",

    // shop.html / product.html
    "Shop – Quartz Mølle": "Shop – Quartz Mølle",
    "Produkt – Quartz Mølle": "Product – Quartz Mølle",
    "Alle produkter": "All products",
    "Økologisk mel malet på stenkværn – dyrket og malet i Norden med omtanke for smag og natur.": "Organic flour milled on a stone mill – grown and milled in the Nordics with care for flavour and nature.",
    "Søg efter produkter…": "Search for products…",
    "Søg efter produkter": "Search for products",
    "Ryd søgning": "Clear search",
    "Indlæser produkter…": "Loading products…",
    "Ingen produkter fundet.": "No products found.",
    "Quartz Mølle · Økologisk stenmalet mel": "Quartz Mølle · Organic stone-milled flour",
    "Indlæser produkt…": "Loading product…",
    "Mere fra møllen": "More from the mill",
    "Du vil måske også kunne lide": "You might also like",
    "Bestseller": "Bestseller",
    "← Tilbage til shop": "← Back to shop",

    // product.js UI
    "Næringsindhold er ikke tilgængelig for dette produkt.": "Nutritional information is not available for this product.",
    "Næringsindhold pr. 100 g": "Nutritional values per 100 g",
    "Energi": "Energy",
    "Fedt": "Fat",
    "heraf mættede fedtsyrer": "of which saturated fatty acids",
    "Kulhydrat": "Carbohydrate",
    "heraf sukkerarter": "of which sugars",
    "Kostfibre": "Dietary fibre",
    "Levering til pakkeshop i Danmark – max 20 kg": "Delivery to a parcel shop in Denmark – max 20 kg",
    "Levering til privatadresse i Danmark – max 25 kg": "Delivery to a private address in Denmark – max 25 kg",
    "Bemærk: Du kan ikke bestille 2 stk. 12,5 kg melposer i samme ordre. Vores 12,5 kg poser indeholder altid lidt mere mel end angivet, så to af dem vejer omkring 25,2 kg – hvilket overskrider GLS' grænse på 25 kg.": "Please note: You cannot order 2 of the 12.5 kg flour bags in the same order. Our 12.5 kg bags always contain slightly more flour than stated, so two of them weigh around 25.2 kg – which exceeds GLS' 25 kg limit.",
    "Vælg størrelse": "Choose size",
    "Antal": "Quantity",
    "Mindre": "Decrease",
    "Mere": "Increase",
    "Tilføj til kurv": "Add to cart",
    "Fragt beregnes ved checkout": "Shipping calculated at checkout",
    "Sikker betaling via Stripe": "Secure payment via Stripe",
    "Fragt regler": "Shipping rules",
    "Næringsindhold": "Nutritional information",

    // cart.js
    "Kurv": "Cart",
    "Din kurv": "Your cart",
    "Luk": "Close",
    "I alt": "Total",
    "Til kassen": "Checkout",
    "Sikker betaling med Stripe": "Secure payment with Stripe",
    "Din kurv er tom.": "Your cart is empty.",
    "Forbereder…": "Preparing…",
    "Netværksfejl — tjek forbindelse og prøv igen.": "Network error — check your connection and try again.",

    // checkout.html / success.html
    "Checkout – Quartz Mølle": "Checkout – Quartz Mølle",
    "Tak for din ordre! – Quartz Mølle": "Thank You for Your Order! – Quartz Mølle",
    "Kassen": "Checkout",
    "Udfyld oplysninger og vælg levering": "Fill in your details and choose delivery",
    "Tak for din ordre!": "Thank you for your order!",
    "Vi har modtaget din bestilling og pakker den hurtigst muligt. Du modtager en bekræftelse på email om kort tid.": "We have received your order and will pack it as quickly as possible. You will receive a confirmation by email shortly.",
    "Ordrenummer": "Order number",
    "Din ordre": "Your order",
    "Levering": "Delivery",
    "Fortsæt shopping": "Continue shopping",
    "Gratis": "Free",

    // products.js — types
    "Fuldkornshvedemel": "Wholegrain wheat flour",
    "Mellemsigtet hvedemel – Type 85": "Medium-sifted wheat flour – Type 85",
    "Fintsigtet hvedemel – Type 70": "Fine-sifted wheat flour – Type 70",
    "Rugmel fuldkorn": "Wholegrain rye flour",
    "Fuldkornsmel": "Wholegrain flour",
    // products.js — names (proper variety names kept as-is)
    "Purpurhvede": "Purple wheat",
    "Rød hvede": "Red wheat",
    "Rug": "Rye",
    // products.js — descriptions
    "Dalarna er en klassisk dansk hvedesort med en rig smag og god bageevne. Perfekt til rugbrød, boller og grovbrød. Dyrket og malet i Danmark.": "Dalarna is a classic Danish wheat variety with a rich flavour and excellent baking qualities. Perfect for rye bread, rolls and hearty wholemeal breads. Grown and milled in Denmark.",
    "Dalarna Type 85 er et mellemsigtet mel der bevarer mere af kornets naturlige smag og næringsindhold end fintere mel. Ideel til brød med karakter.": "Dalarna Type 85 is a medium-sifted flour that retains more of the grain's natural flavour and nutrients than finer flours. Ideal for breads with character.",
    "Mariagertoba er et fintsigtet hvedemel med fremragende bageegenskaber. Det giver luftige og velsmagende brød og boller. En af vores mest elskede sorter.": "Mariagertoba is a fine-sifted wheat flour with outstanding baking properties. It produces light, flavourful breads and rolls. One of our most beloved varieties.",
    "Ølandshvede er en gammel nordisk kornsort med en kompleks og nøddeagtig smag. Perfekt til surdejsbrød og håndværkerbrød der kræver karakter.": "Øland wheat is an ancient Nordic grain variety with a complex, nutty flavour. Perfect for sourdough and artisan breads that call for character.",
    "Ølands Type 85 kombinerer det bedste fra fuldkorn og hvidt mel. En alsidig meltype der giver brød med dybde og god struktur.": "Øland Type 85 combines the best of wholegrain and white flour. A versatile flour that gives breads depth and a fine structure.",
    "Purpurhvede er en smuk og sjælden hvedesort med en dyb, lilla farve. Rig på antioxidanter og med en markant, sødlig smag der løfter ethvert bagværk.": "Purple wheat is a beautiful, rare wheat variety with a deep purple colour. Rich in antioxidants and with a distinctive, sweet flavour that elevates any bake.",
    "Rød hvede er en klassisk dansk hvedesort med en smuk rødlig farve og en fyldig, robust smag. Ideel til grove brød og boller med karakter.": "Red wheat is a classic Danish wheat variety with a beautiful reddish colour and a full, robust flavour. Ideal for hearty wholemeal breads and rolls with character.",
    "Rød hvede Type 70 er et let sigtet mel der giver luftige og velsmagende brød. Perfekt når du ønsker det bedste fra rød hvede i en finere tekstur.": "Red wheat Type 70 is a lightly sifted flour that produces light, flavourful breads. Perfect when you want the best of red wheat in a finer texture.",
    "Rød hvede Type 85 er det perfekte kompromis mellem fuldkorn og finere mel. Beholder kornets naturlige smag med en mere tilgængelig tekstur.": "Red wheat Type 85 is the perfect compromise between wholegrain and finer flour. It keeps the grain's natural flavour with a more approachable texture.",
    "Vores rugmel er malet af hele rugkerner på stenkværn. Rig på fibre og med en dyb, jordnær smag der er uundværlig i det klassiske danske rugbrød.": "Our rye flour is stone-milled from whole rye kernels. Rich in fibre and with a deep, earthy flavour that is indispensable in classic Danish rye bread.",
    "Spelt er en urgammel kornsort med en nøddeagtig, sødlig smag. Lettere fordøjeligt end hvede og perfekt til brød, kager og pasta med en særlig karakter.": "Spelt is an ancient grain with a nutty, sweet flavour. Easier to digest than wheat and perfect for breads, cakes and pasta with a distinctive character.",
    // products.js — certifications & origin
    "Dansk jordbrug": "Danish agriculture",
    "EU-jordbrug": "EU agriculture",
    "EU-Jordbrug": "EU agriculture",
    "Dyrket i Norden & malet på stenkværn": "Grown in the Nordics & stone-milled",
    "Malet på stenkværn i Danmark": "Stone-milled in Denmark",

    // locker.html (internal staff panel)
    "Skabsstyring · Quartz Mølle": "Cabinet Management · Quartz Mølle",
    "Skabsstyring": "Cabinet Management",
    "Indtast adgangskode": "Enter passcode",
    "Lås op": "Unlock",
    "Log ud": "Log out",
    "＋ Ny aflevering": "＋ New deposit",
    "↻ Opdatér": "↻ Refresh",
    "🔓 Åbn alle": "🔓 Open all",
    "🧹 Ryd alle": "🧹 Clear all",
    "/ 22 optaget": "/ 22 occupied",
    "Historik": "History",
    "Forkert kode": "Wrong passcode",
    "Netværksfejl": "Network error",
    "lige nu": "just now",
    "min siden": "min ago",
    "Tablet online": "Tablet online",
    "Tablet offline": "Tablet offline",
    "ledige": "available",
    "Ud af drift": "Out of service",
    "Ledig": "Available",
    "Ingen hændelser endnu.": "No events yet.",
    "Aflevering": "Deposit",
    "Afhentning": "Pickup",
    "Dør åbnet": "Door opened",
    "Alle døre åbnet": "All doors opened",
    "Alle skabe ryddet": "All cabinets cleared",
    "Sat ud af drift": "Set out of service",
    "Sat i drift": "Set in service",
    "Åbn dør": "Open door",
    "Ryd skab (markér ledig)": "Clear cabinet (mark available)",
    "Sæt i drift": "Set in service",
    "Sæt ud af drift": "Set out of service",
    "Annullér": "Cancel",
    "Hvor mange skabe?": "How many cabinets?",
    "Vælg antal skabe til ordren": "Select the number of cabinets for the order",
    "Opret kode": "Create code",
    "Læg pakken i skab": "Place the package in cabinet",
    "Kode til kunden": "Code for the customer",
    "Kopiér kode": "Copy code",
    "Færdig": "Done",
    "Åbn ALLE skabe?": "Open ALL cabinets?",
    "Alle 22 døre åbnes fysisk på lockeren, én ad gangen.": "All 22 doors are opened physically on the locker, one at a time.",
    "Ja, åbn alle": "Yes, open all",
    "Åbner alle skabe…": "Opening all cabinets…",
    "Ryd ALLE skabe?": "Clear ALL cabinets?",
    "Alle skabe markeres ledige og koderne fjernes. Kan ikke fortrydes.": "All cabinets are marked available and the codes are removed. Cannot be undone.",
    "Ja, ryd alle": "Yes, clear all",
    "Døren åbnes fysisk på lockeren.": "The door is opened physically on the locker.",
    "Ja, åbn døren": "Yes, open the door",
    "Fejl": "Error",
    "Alle skabe er optaget": "All cabinets are occupied",

    // fulfill.html (staff Click & Collect fulfilment page)
    "Click & Collect – Quartz Mølle": "Click & Collect – Quartz Mølle",
    "Click & Collect ordrer": "Click & Collect orders",
    "Log ind": "Log in",
    "Kodeord": "Password",
    "Afventende ordrer": "Pending orders",
    "Afsendte ordrer": "Completed orders",
    "Aktive skab-koder": "Active cabinet codes",
    "Ingen afventende ordrer.": "No pending orders.",
    "Ingen aktive koder.": "No active codes.",
    "Skab-/dør-nummer": "Cabinet/door number",
    "Send kode til kunde": "Send code to customer",
    "Opdater": "Refresh",
    "Sender…": "Sending…",
    "Sendt!": "Sent!",
    "Kunne ikke sende. Prøv igen.": "Could not send. Try again.",
    "Skriv et skab-/dør-nummer først.": "Enter a cabinet/door number first.",
    "Der er ingen aktiv kode for det skab. Deponer ordren i skabet på /locker først.": "There is no active code for that cabinet. Deposit the order in the cabinet on /locker first.",
    "Ordre": "Order",
    "Vare": "Item",
    "Varer": "Items",
    "Sendt": "Sent",
    "Dør": "Door",
    "Kode": "Code"
  };

  // Substring / pattern rules applied to text nodes that don't have an exact match.
  // Used for nodes that mix static labels with dynamic values.
  var QM_RULES = [
    [/^Fra (\d[\d.,]*\s*kr\.)$/, 'From $1'],          // "Fra 99,00 kr." -> "From 99,00 kr."
    [/(^|\s)Antal:/g, '$1Quantity:'],                  // "3 kg · Antal: 2"
    [/Kunne ikke åbne betaling \(status/g, 'Could not open payment (status'],
    [/\bPrøv igen\./g, 'Try again.']
  ];

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  function translateText(raw) {
    if (raw == null) return raw;
    var trimmed = raw.trim();
    if (!trimmed) return raw;
    if (Object.prototype.hasOwnProperty.call(QM_DICT, trimmed)) {
      // Preserve original surrounding whitespace
      return raw.replace(trimmed, QM_DICT[trimmed]);
    }
    var out = raw, changed = false;
    for (var i = 0; i < QM_RULES.length; i++) {
      var next = out.replace(QM_RULES[i][0], QM_RULES[i][1]);
      if (next !== out) { out = next; changed = true; }
    }
    return changed ? out : raw;
  }

  function skip(el) {
    if (!el) return false;
    var tag = el.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return true;
    if (el.closest && el.closest('[data-no-i18n]')) return true;
    return false;
  }

  function translateAttrs(el) {
    if (!el || !el.hasAttribute) return;
    for (var a = 0; a < ATTRS.length; a++) {
      if (el.hasAttribute(ATTRS[a])) {
        var v = el.getAttribute(ATTRS[a]);
        var tv = translateText(v);
        if (tv !== v) el.setAttribute(ATTRS[a], tv);
      }
    }
  }

  function translateNode(node) {
    if (node.nodeType === 3) { // text node
      if (node.__qmT) return;
      if (skip(node.parentNode)) return;
      var t = translateText(node.nodeValue);
      if (t !== node.nodeValue) node.nodeValue = t;
      node.__qmT = true;
      return;
    }
    if (node.nodeType !== 1) return; // only elements below
    if (skip(node)) return;

    // attributes on this element and every descendant element
    translateAttrs(node);
    var elWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, null);
    var e;
    while ((e = elWalker.nextNode())) { if (!skip(e)) translateAttrs(e); }

    // text nodes
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (n.__qmT) continue;
      if (skip(n.parentNode)) continue;
      var nt = translateText(n.nodeValue);
      if (nt !== n.nodeValue) n.nodeValue = nt;
      n.__qmT = true;
    }
  }

  function translateAll() {
    // <title>
    if (document.title) {
      var tt = translateText(document.title);
      if (tt !== document.title) document.title = tt;
    }
    translateNode(document.body);
  }

  // ── Language dropdown injected into each .nav ──
  function buildSwitch(lang) {
    var wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.setAttribute('data-no-i18n', '');
    wrap.innerHTML =
      '<button class="lang-switch-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Language">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
        '<span class="lang-current">' + (lang === 'en' ? 'EN' : 'DA') + '</span>' +
        '<svg class="lang-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button>' +
      '<div class="lang-switch-menu">' +
        '<button type="button" data-lang="da"' + (lang === 'da' ? ' class="active"' : '') + '>Dansk</button>' +
        '<button type="button" data-lang="en"' + (lang === 'en' ? ' class="active"' : '') + '>English</button>' +
      '</div>';

    var btn = wrap.querySelector('.lang-switch-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    wrap.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        var chosen = b.getAttribute('data-lang');
        if (chosen !== lang) setLang(chosen);
        else wrap.classList.remove('open');
      });
    });
    document.addEventListener('click', function () { wrap.classList.remove('open'); });
    return wrap;
  }

  function injectSwitches(lang) {
    var placed = 0;
    document.querySelectorAll('.nav').forEach(function (nav) {
      if (nav.querySelector('.lang-switch')) { placed++; return; }
      var sw = buildSwitch(lang);
      var cta = nav.querySelector('.nav-cta');
      var burger = nav.querySelector('.nav-burger');
      if (cta) nav.insertBefore(sw, cta);
      else if (burger) nav.insertBefore(sw, burger);
      else nav.appendChild(sw);
      placed++;
    });
    // Also offer it in the mobile menu
    document.querySelectorAll('.mobile-menu').forEach(function (menu) {
      if (menu.querySelector('.lang-switch')) return;
      menu.appendChild(buildSwitch(lang));
    });
    // Explicit slots (e.g. internal panels like /locker, /fulfill)
    document.querySelectorAll('[data-lang-slot]').forEach(function (slot) {
      if (slot.querySelector('.lang-switch')) { placed++; return; }
      slot.appendChild(buildSwitch(lang));
      placed++;
    });
    // Fallback: pages with no nav/menu/slot get a floating control so the
    // language option is always available (internal panels, etc.).
    if (placed === 0 && document.body) {
      var fsw = buildSwitch(lang);
      fsw.classList.add('lang-switch--floating');
      document.body.appendChild(fsw);
    }
  }

  function init() {
    var lang = currentLang();
    document.documentElement.lang = lang;
    injectSwitches(lang);

    if (lang === 'en') {
      translateAll();
      // Keep translating dynamically-rendered content (cart, cards, checkout, …)
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          for (var j = 0; j < m.addedNodes.length; j++) translateNode(m.addedNodes[j]);
          if (m.type === 'characterData' && m.target) { m.target.__qmT = false; translateNode(m.target); }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.QuartzI18n = { lang: currentLang, set: setLang, t: function (s) { return (currentLang() === 'en' && QM_DICT[s]) || s; } };
})();
