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
    try { var v = localStorage.getItem(LANG_KEY); return (v === 'en' || v === 'es') ? v : 'da'; } catch (e) { return 'da'; }
  }
  function setLang(lang) {
    var v = (lang === 'en' || lang === 'es') ? lang : 'da';
    try { localStorage.setItem(LANG_KEY, v); } catch (e) {}
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
    "Kode": "Code",

    // locker/fufill — newer strings (deposit flow, print, buttons)
    "Ordre-fulfillment (Click & Collect)": "Order fulfilment (Click & Collect)",
    "📦 Ordre-fulfillment (Click & Collect)": "📦 Order fulfilment (Click & Collect)",
    "Ordre-fulfillment": "Order fulfilment",
    "Kode sendt til kunden ✓": "Code sent to the customer ✓",
    "Kunne ikke sende": "Could not send",
    "Ingen ordre / færdig": "No order / done",
    "📧 Send koden til kunden — vælg ordren:": "📧 Send the code to the customer — pick the order:",
    "Ingen afventende online-ordrer. Kopiér koden og giv den til kunden.": "No pending online orders. Copy the code and give it to the customer.",
    "Send kode": "Send code",
    "Ordrebekræftelse": "Order confirmation",
    "Tak for din ordre": "Thank you for your order"
  };

  // ── Danish → Spanish dictionary (same keys as QM_DICT) ──
  var QM_DICT_ES = {
    // Navigation / shared
    "Hjem": "Inicio",
    "Forhandlere": "Distribuidores",
    "Om os": "Sobre nosotros",
    "Kontakt": "Contacto",
    "Shop Nu": "Comprar ahora",
    "EU Økologi": "Ecológico UE",
    "Statskontrolleret Økologisk": "Ecológico con control estatal",
    "Smileyrapport – se vores kontrolrapport fra Fødevarestyrelsen": "Informe Smiley – vea nuestro informe de inspección de la Agencia Danesa de Alimentos",
    "Smiley­rapport": "Informe Smiley",

    // index.html
    "Quartz Mølle – Økologisk Mel fra Stenkværn": "Quartz Mølle – Harina ecológica molida a la piedra",
    "Økologisk mel – malet på stenkværn i Danmark": "Harina ecológica – molida a la piedra en Dinamarca",
    "Se vores mel": "Ver nuestra harina",
    "Vores historie": "Nuestra historia",
    "Fra mark til mel": "Del campo a la harina",
    "Vi dyrker og maler vores korn på stenkværn i hjertet af Danmark. Hver pose mel bærer historien om jord, sol og omtanke.": "Cultivamos y molemos nuestro grano a la piedra en el corazón de Dinamarca. Cada bolsa de harina lleva la historia de la tierra, el sol y el cuidado.",
    "Læs mere": "Leer más",
    "Vores sortiment": "Nuestra gama",
    "9 varianter af enestående mel": "9 variedades de harina excepcional",
    "Varianterne skifter naturligvis efter sæsonen": "Las variedades cambian naturalmente según la temporada",
    "Fra Dalarna til Purpurhvede – hvert mel har sin egen karakter, smag og bagningsegenskaber.": "De Dalarna al trigo púrpura: cada harina tiene su propio carácter, sabor y propiedades de horneado.",
    "Se alle produkter": "Ver todos los productos",
    "Udvalgte produkter": "Productos seleccionados",
    "Se hele sortimentet": "Ver toda la gama",
    "Hvorfor Quartz Mølle?": "¿Por qué Quartz Mølle?",
    "Mel med mening": "Harina con sentido",
    "Stenkværnet": "Molida a la piedra",
    "– Langsom formaling bevarer næringsstoffer og smag": "– La molienda lenta conserva los nutrientes y el sabor",
    "Nordisk korn": "Grano nórdico",
    "– Dyrket på nordisk jord med respekt for naturen": "– Cultivado en suelo nórdico con respeto por la naturaleza",
    "Certificeret økologisk": "Certificado ecológico",
    "– EU-Øko & Statskontrolleret Økologisk": "– Ecológico UE y ecológico con control estatal",
    "Direkte fra mølle": "Directo del molino",
    "– Ingen mellemmænd, frisk mel til dig": "– Sin intermediarios, harina fresca para ti",
    "Find os": "Encuéntranos",
    "4160 Herlufmagle, Danmark": "4160 Herlufmagle, Dinamarca",

    // om.html
    "Om os – Quartz Mølle": "Sobre nosotros – Quartz Mølle",
    "Quartz Mølle – Smag, Stabilitet og Stenmalet Kvalitet": "Quartz Mølle – Sabor, consistencia y calidad molida a la piedra",
    "Hos Quartz Mølle forener vi traditionelt håndværk med moderne indsigt i at fremstille noget af Danmarks mest smagfulde og stabile økologiske mel. Vi samarbejder med økologiske landmænd fra Danmark og Sverige og udvælger kun de bedste, mest næringsrige kornsorter, som vi maler nænsomt – og altid med fokus på smag, sundhed og bageevne.": "En Quartz Mølle unimos la artesanía tradicional con el conocimiento moderno para elaborar algunas de las harinas ecológicas más sabrosas y consistentes de Dinamarca. Trabajamos con agricultores ecológicos de Dinamarca y Suecia y seleccionamos solo las mejores variedades de grano, las más nutritivas, que molemos con delicadeza, siempre con atención al sabor, la salud y la capacidad de horneado.",
    "Vores mølle er navngivet Quartz Mølle da vores møllesten er rige på kvarts, men også emery og flint – hårde stenarter, som sikrer en præcis, skånsom og stabil formaling. I stedet for at kværne kornet hårdt under høj temperatur, bevarer vi næringsstofferne ved at male langsomt: kun 115 omdrejninger i minuttet – mod de typiske 330 rpm i mange andre stenkværn.": "Nuestro molino se llama Quartz Mølle porque nuestras piedras de moler son ricas en cuarzo, pero también en esmeril y sílex: minerales duros que garantizan una molienda precisa, suave y consistente. En lugar de moler el grano con fuerza a alta temperatura, conservamos los nutrientes moliendo despacio: solo 115 revoluciones por minuto, frente a las 330 rpm habituales en muchos otros molinos de piedra.",
    "Vi kombinerer vores skånsomme stenformaling med en dobbelt valsemølle fra 1949, som giver os en unik kontrol over struktur og konsistens. Det betyder mel med høj bagekvalitet, stor smag og en stabilitet, som professionelle bagere og passionerede hjemmebagere kan stole på – hver gang. Hos Quartz Mølle tror vi på gennemsigtighed, ærlighed og et kompromisløst fokus på kvalitet. Vi sætter en dyd i at levere det bedste, naturen og håndværket kan tilbyde.": "Combinamos nuestra suave molienda a la piedra con un molino de rodillos doble de 1949, que nos da un control único sobre la estructura y la consistencia. El resultado es una harina de gran calidad de horneado, mucho sabor y una consistencia en la que los panaderos profesionales y los aficionados apasionados pueden confiar, siempre. En Quartz Mølle creemos en la transparencia, la honestidad y un enfoque en la calidad sin concesiones. Nos enorgullece ofrecer lo mejor que la naturaleza y la artesanía pueden dar.",
    "Quartz Mølle stenkværn": "Molino de piedra Quartz Mølle",

    // forhandlere.html
    "Forhandlere – Quartz Mølle": "Distribuidores – Quartz Mølle",
    "Find en Quartz Mølle forhandler i nærheden af dig.": "Encuentra un distribuidor de Quartz Mølle cerca de ti.",
    "Find en Quartz Mølle forhandler i nærheden af dig. Klik på et logo for at se butikkens hjemmeside.": "Encuentra un distribuidor de Quartz Mølle cerca de ti. Haz clic en un logotipo para ver la web de la tienda.",
    "Besøg hjemmeside →": "Visitar la web →",

    // shop.html / product.html
    "Shop – Quartz Mølle": "Tienda – Quartz Mølle",
    "Produkt – Quartz Mølle": "Producto – Quartz Mølle",
    "Alle produkter": "Todos los productos",
    "Økologisk mel malet på stenkværn – dyrket og malet i Norden med omtanke for smag og natur.": "Harina ecológica molida a la piedra: cultivada y molida en los países nórdicos con cuidado por el sabor y la naturaleza.",
    "Søg efter produkter…": "Buscar productos…",
    "Søg efter produkter": "Buscar productos",
    "Ryd søgning": "Borrar búsqueda",
    "Indlæser produkter…": "Cargando productos…",
    "Ingen produkter fundet.": "No se han encontrado productos.",
    "Quartz Mølle · Økologisk stenmalet mel": "Quartz Mølle · Harina ecológica molida a la piedra",
    "Indlæser produkt…": "Cargando producto…",
    "Mere fra møllen": "Más del molino",
    "Du vil måske også kunne lide": "También te puede gustar",
    "Bestseller": "Más vendido",
    "← Tilbage til shop": "← Volver a la tienda",

    // product.js UI
    "Næringsindhold er ikke tilgængelig for dette produkt.": "La información nutricional no está disponible para este producto.",
    "Næringsindhold pr. 100 g": "Valores nutricionales por 100 g",
    "Energi": "Energía",
    "Fedt": "Grasas",
    "heraf mættede fedtsyrer": "de las cuales saturadas",
    "Kulhydrat": "Hidratos de carbono",
    "heraf sukkerarter": "de los cuales azúcares",
    "Kostfibre": "Fibra alimentaria",
    "Levering til pakkeshop i Danmark – max 20 kg": "Entrega a punto de recogida en Dinamarca – máx. 20 kg",
    "Levering til privatadresse i Danmark – max 25 kg": "Entrega a domicilio en Dinamarca – máx. 25 kg",
    "Bemærk: Du kan ikke bestille 2 stk. 12,5 kg melposer i samme ordre. Vores 12,5 kg poser indeholder altid lidt mere mel end angivet, så to af dem vejer omkring 25,2 kg – hvilket overskrider GLS' grænse på 25 kg.": "Nota: no puedes pedir 2 bolsas de harina de 12,5 kg en el mismo pedido. Nuestras bolsas de 12,5 kg siempre contienen algo más de harina de lo indicado, por lo que dos de ellas pesan alrededor de 25,2 kg, lo que supera el límite de 25 kg de GLS.",
    "Vælg størrelse": "Elige el tamaño",
    "Antal": "Cantidad",
    "Mindre": "Menos",
    "Mere": "Más",
    "Tilføj til kurv": "Añadir a la cesta",
    "Fragt beregnes ved checkout": "Los gastos de envío se calculan al finalizar la compra",
    "Sikker betaling via Stripe": "Pago seguro con Stripe",
    "Fragt regler": "Normas de envío",
    "Næringsindhold": "Información nutricional",

    // cart.js
    "Kurv": "Cesta",
    "Din kurv": "Tu cesta",
    "Luk": "Cerrar",
    "I alt": "Total",
    "Til kassen": "Finalizar compra",
    "Sikker betaling med Stripe": "Pago seguro con Stripe",
    "Din kurv er tom.": "Tu cesta está vacía.",
    "Forbereder…": "Preparando…",
    "Netværksfejl — tjek forbindelse og prøv igen.": "Error de red: comprueba tu conexión e inténtalo de nuevo.",

    // checkout.html / success.html
    "Checkout – Quartz Mølle": "Pago – Quartz Mølle",
    "Tak for din ordre! – Quartz Mølle": "¡Gracias por tu pedido! – Quartz Mølle",
    "Kassen": "Pago",
    "Udfyld oplysninger og vælg levering": "Rellena tus datos y elige la entrega",
    "Tak for din ordre!": "¡Gracias por tu pedido!",
    "Vi har modtaget din bestilling og pakker den hurtigst muligt. Du modtager en bekræftelse på email om kort tid.": "Hemos recibido tu pedido y lo prepararemos lo antes posible. Recibirás una confirmación por correo electrónico en breve.",
    "Ordrenummer": "Número de pedido",
    "Din ordre": "Tu pedido",
    "Levering": "Entrega",
    "Fortsæt shopping": "Seguir comprando",
    "Gratis": "Gratis",

    // products.js — types
    "Fuldkornshvedemel": "Harina integral de trigo",
    "Mellemsigtet hvedemel – Type 85": "Harina de trigo semiintegral – Tipo 85",
    "Fintsigtet hvedemel – Type 70": "Harina de trigo refinada – Tipo 70",
    "Rugmel fuldkorn": "Harina integral de centeno",
    "Fuldkornsmel": "Harina integral",
    // products.js — names
    "Purpurhvede": "Trigo púrpura",
    "Rød hvede": "Trigo rojo",
    "Rug": "Centeno",
    // products.js — descriptions
    "Dalarna er en klassisk dansk hvedesort med en rig smag og god bageevne. Perfekt til rugbrød, boller og grovbrød. Dyrket og malet i Danmark.": "Dalarna es una variedad clásica de trigo danés con un sabor intenso y excelentes cualidades de horneado. Perfecta para pan de centeno, bollos y panes rústicos. Cultivada y molida en Dinamarca.",
    "Dalarna Type 85 er et mellemsigtet mel der bevarer mere af kornets naturlige smag og næringsindhold end fintere mel. Ideel til brød med karakter.": "Dalarna Tipo 85 es una harina semiintegral que conserva más del sabor natural y los nutrientes del grano que las harinas más finas. Ideal para panes con carácter.",
    "Mariagertoba er et fintsigtet hvedemel med fremragende bageegenskaber. Det giver luftige og velsmagende brød og boller. En af vores mest elskede sorter.": "Mariagertoba es una harina de trigo refinada con excelentes propiedades de horneado. Produce panes y bollos esponjosos y sabrosos. Una de nuestras variedades más queridas.",
    "Ølandshvede er en gammel nordisk kornsort med en kompleks og nøddeagtig smag. Perfekt til surdejsbrød og håndværkerbrød der kræver karakter.": "El trigo Öland es una antigua variedad de grano nórdico con un sabor complejo y a frutos secos. Perfecto para panes de masa madre y panes artesanos que requieren carácter.",
    "Ølands Type 85 kombinerer det bedste fra fuldkorn og hvidt mel. En alsidig meltype der giver brød med dybde og god struktur.": "Öland Tipo 85 combina lo mejor de la harina integral y la blanca. Una harina versátil que da a los panes profundidad y una buena estructura.",
    "Purpurhvede er en smuk og sjælden hvedesort med en dyb, lilla farve. Rig på antioxidanter og med en markant, sødlig smag der løfter ethvert bagværk.": "El trigo púrpura es una variedad bonita y poco común con un intenso color morado. Rico en antioxidantes y con un sabor marcado y dulce que realza cualquier horneado.",
    "Rød hvede er en klassisk dansk hvedesort med en smuk rødlig farve og en fyldig, robust smag. Ideel til grove brød og boller med karakter.": "El trigo rojo es una variedad clásica de trigo danés con un bonito color rojizo y un sabor pleno y robusto. Ideal para panes rústicos y bollos con carácter.",
    "Rød hvede Type 70 er et let sigtet mel der giver luftige og velsmagende brød. Perfekt når du ønsker det bedste fra rød hvede i en finere tekstur.": "El trigo rojo Tipo 70 es una harina ligeramente tamizada que produce panes esponjosos y sabrosos. Perfecta cuando quieres lo mejor del trigo rojo con una textura más fina.",
    "Rød hvede Type 85 er det perfekte kompromis mellem fuldkorn og finere mel. Beholder kornets naturlige smag med en mere tilgængelig tekstur.": "El trigo rojo Tipo 85 es el equilibrio perfecto entre la harina integral y la más fina. Conserva el sabor natural del grano con una textura más accesible.",
    "Vores rugmel er malet af hele rugkerner på stenkværn. Rig på fibre og med en dyb, jordnær smag der er uundværlig i det klassiske danske rugbrød.": "Nuestra harina de centeno se muele a la piedra a partir de granos enteros de centeno. Rica en fibra y con un sabor profundo y terroso, imprescindible en el clásico pan de centeno danés.",
    "Spelt er en urgammel kornsort med en nøddeagtig, sødlig smag. Lettere fordøjeligt end hvede og perfekt til brød, kager og pasta med en særlig karakter.": "La espelta es un grano ancestral con un sabor dulce y a frutos secos. Más fácil de digerir que el trigo y perfecta para panes, pasteles y pasta con un carácter especial.",
    // products.js — certifications & origin
    "Dansk jordbrug": "Agricultura danesa",
    "EU-jordbrug": "Agricultura de la UE",
    "EU-Jordbrug": "Agricultura de la UE",
    "Dyrket i Norden & malet på stenkværn": "Cultivado en los países nórdicos y molido a la piedra",
    "Malet på stenkværn i Danmark": "Molido a la piedra en Dinamarca",

    // locker.html (internal staff panel)
    "Skabsstyring · Quartz Mølle": "Gestión de taquillas · Quartz Mølle",
    "Skabsstyring": "Gestión de taquillas",
    "Indtast adgangskode": "Introduce el código de acceso",
    "Lås op": "Desbloquear",
    "Log ud": "Cerrar sesión",
    "＋ Ny aflevering": "＋ Nueva entrega",
    "↻ Opdatér": "↻ Actualizar",
    "🔓 Åbn alle": "🔓 Abrir todas",
    "🧹 Ryd alle": "🧹 Vaciar todas",
    "/ 22 optaget": "/ 22 ocupadas",
    "Historik": "Historial",
    "Forkert kode": "Código incorrecto",
    "Netværksfejl": "Error de red",
    "lige nu": "ahora mismo",
    "min siden": "min atrás",
    "Tablet online": "Tablet en línea",
    "Tablet offline": "Tablet sin conexión",
    "ledige": "libres",
    "Ud af drift": "Fuera de servicio",
    "Ledig": "Libre",
    "Ingen hændelser endnu.": "Aún no hay eventos.",
    "Aflevering": "Entrega",
    "Afhentning": "Recogida",
    "Dør åbnet": "Puerta abierta",
    "Alle døre åbnet": "Todas las puertas abiertas",
    "Alle skabe ryddet": "Todas las taquillas vaciadas",
    "Sat ud af drift": "Puesta fuera de servicio",
    "Sat i drift": "Puesta en servicio",
    "Åbn dør": "Abrir puerta",
    "Ryd skab (markér ledig)": "Vaciar taquilla (marcar libre)",
    "Sæt i drift": "Poner en servicio",
    "Sæt ud af drift": "Poner fuera de servicio",
    "Annullér": "Cancelar",
    "Hvor mange skabe?": "¿Cuántas taquillas?",
    "Vælg antal skabe til ordren": "Elige el número de taquillas para el pedido",
    "Opret kode": "Crear código",
    "Læg pakken i skab": "Coloca el paquete en la taquilla",
    "Kode til kunden": "Código para el cliente",
    "Kopiér kode": "Copiar código",
    "Færdig": "Listo",
    "Åbn ALLE skabe?": "¿Abrir TODAS las taquillas?",
    "Alle 22 døre åbnes fysisk på lockeren, én ad gangen.": "Las 22 puertas se abren físicamente en la taquilla, una a una.",
    "Ja, åbn alle": "Sí, abrir todas",
    "Åbner alle skabe…": "Abriendo todas las taquillas…",
    "Ryd ALLE skabe?": "¿Vaciar TODAS las taquillas?",
    "Alle skabe markeres ledige og koderne fjernes. Kan ikke fortrydes.": "Todas las taquillas se marcan como libres y se eliminan los códigos. No se puede deshacer.",
    "Ja, ryd alle": "Sí, vaciar todas",
    "Døren åbnes fysisk på lockeren.": "La puerta se abre físicamente en la taquilla.",
    "Ja, åbn døren": "Sí, abrir la puerta",
    "Fejl": "Error",
    "Alle skabe er optaget": "Todas las taquillas están ocupadas",

    // fulfill.html (staff Click & Collect fulfilment page)
    "Click & Collect – Quartz Mølle": "Click & Collect – Quartz Mølle",
    "Click & Collect ordrer": "Pedidos Click & Collect",
    "Log ind": "Iniciar sesión",
    "Kodeord": "Contraseña",
    "Afventende ordrer": "Pedidos pendientes",
    "Afsendte ordrer": "Pedidos enviados",
    "Aktive skab-koder": "Códigos de taquilla activos",
    "Ingen afventende ordrer.": "No hay pedidos pendientes.",
    "Ingen aktive koder.": "No hay códigos activos.",
    "Skab-/dør-nummer": "Número de taquilla/puerta",
    "Send kode til kunde": "Enviar código al cliente",
    "Opdater": "Actualizar",
    "Sender…": "Enviando…",
    "Sendt!": "¡Enviado!",
    "Kunne ikke sende. Prøv igen.": "No se pudo enviar. Inténtalo de nuevo.",
    "Skriv et skab-/dør-nummer først.": "Escribe primero un número de taquilla/puerta.",
    "Der er ingen aktiv kode for det skab. Deponer ordren i skabet på /locker først.": "No hay código activo para esa taquilla. Deposita primero el pedido en la taquilla en /locker.",
    "Ordre": "Pedido",
    "Vare": "Artículo",
    "Varer": "Artículos",
    "Sendt": "Enviado",
    "Dør": "Puerta",
    "Kode": "Código",

    // locker/fufill — newer strings
    "Ordre-fulfillment (Click & Collect)": "Gestión de pedidos (Click & Collect)",
    "📦 Ordre-fulfillment (Click & Collect)": "📦 Gestión de pedidos (Click & Collect)",
    "Ordre-fulfillment": "Gestión de pedidos",
    "Kode sendt til kunden ✓": "Código enviado al cliente ✓",
    "Kunne ikke sende": "No se pudo enviar",
    "Ingen ordre / færdig": "Sin pedido / listo",
    "📧 Send koden til kunden — vælg ordren:": "📧 Envía el código al cliente — elige el pedido:",
    "Ingen afventende online-ordrer. Kopiér koden og giv den til kunden.": "No hay pedidos en línea pendientes. Copia el código y dáselo al cliente.",
    "Send kode": "Enviar código",
    "Ordrebekræftelse": "Confirmación de pedido",
    "Tak for din ordre": "Gracias por tu pedido"
  };

  // Substring / pattern rules applied to text nodes that don't have an exact match.
  // Used for nodes that mix static labels with dynamic values.
  var QM_RULES = [
    [/^Fra (\d[\d.,]*\s*kr\.)$/, 'From $1'],          // "Fra 99,00 kr." -> "From 99,00 kr."
    [/(^|\s)Antal:/g, '$1Quantity:'],                  // "3 kg · Antal: 2"
    [/Kunne ikke åbne betaling \(status/g, 'Could not open payment (status'],
    [/\bPrøv igen\./g, 'Try again.'],
    // locker dynamic strings (numbers stay in place)
    [/^(\d+) \/ (\d+) optaget$/, '$1 / $2 occupied'],
    [/^(\d+) ledige$/, '$1 available'],
    [/^Skab (\d[\d, ]*) åbnet$/, 'Cabinet $1 opened'],
    [/^Skabe (\d[\d, ]*) åbnet$/, 'Cabinets $1 opened'],
    [/^Vælg (\d+) skabe?$/, 'Choose $1 cabinets'],
    [/^Læg i skab$/, 'Place in cabinet'],
    [/(\d+) min siden/, '$1 min ago'],
    [/Afhentning · Skab/g, 'Pickup · Cabinet'],
    [/Aflevering · Skab/g, 'Deposit · Cabinet']
  ];

  // Spanish equivalents of the pattern rules.
  var QM_RULES_ES = [
    [/^Fra (\d[\d.,]*\s*kr\.)$/, 'Desde $1'],
    [/(^|\s)Antal:/g, '$1Cantidad:'],
    [/Kunne ikke åbne betaling \(status/g, 'No se pudo abrir el pago (estado'],
    [/\bPrøv igen\./g, 'Inténtalo de nuevo.'],
    [/^(\d+) \/ (\d+) optaget$/, '$1 / $2 ocupadas'],
    [/^(\d+) ledige$/, '$1 libres'],
    [/^Skab (\d[\d, ]*) åbnet$/, 'Taquilla $1 abierta'],
    [/^Skabe (\d[\d, ]*) åbnet$/, 'Taquillas $1 abiertas'],
    [/^Vælg (\d+) skabe?$/, 'Elige $1 taquillas'],
    [/^Læg i skab$/, 'Coloca en la taquilla'],
    [/(\d+) min siden/, 'hace $1 min'],
    [/Afhentning · Skab/g, 'Recogida · Taquilla'],
    [/Aflevering · Skab/g, 'Entrega · Taquilla'],
    [/^Offline · /, 'Sin conexión · ']
  ];

  // Active dictionary/rules for the current non-Danish language (set in init()).
  var ACTIVE_DICT = QM_DICT, ACTIVE_RULES = QM_RULES;

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  function translateText(raw) {
    if (raw == null) return raw;
    var trimmed = raw.trim();
    if (!trimmed) return raw;
    if (Object.prototype.hasOwnProperty.call(ACTIVE_DICT, trimmed)) {
      // Preserve original surrounding whitespace
      return raw.replace(trimmed, ACTIVE_DICT[trimmed]);
    }
    var out = raw, changed = false;
    for (var i = 0; i < ACTIVE_RULES.length; i++) {
      var next = out.replace(ACTIVE_RULES[i][0], ACTIVE_RULES[i][1]);
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
  function buildSwitch(lang, allowEs) {
    var wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.setAttribute('data-no-i18n', '');
    wrap.innerHTML =
      '<button class="lang-switch-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Language">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
        '<span class="lang-current">' + (lang === 'en' ? 'EN' : lang === 'es' ? 'ES' : 'DA') + '</span>' +
        '<svg class="lang-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button>' +
      '<div class="lang-switch-menu">' +
        '<button type="button" data-lang="da"' + (lang === 'da' ? ' class="active"' : '') + '>Dansk</button>' +
        '<button type="button" data-lang="en"' + (lang === 'en' ? ' class="active"' : '') + '>English</button>' +
        (allowEs ? '<button type="button" data-lang="es"' + (lang === 'es' ? ' class="active"' : '') + '>Español</button>' : '') +
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

  function injectSwitches(lang, allowEs) {
    var placed = 0;
    document.querySelectorAll('.nav').forEach(function (nav) {
      if (nav.querySelector('.lang-switch')) { placed++; return; }
      var sw = buildSwitch(lang, allowEs);
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
      menu.appendChild(buildSwitch(lang, allowEs));
    });
    // Explicit slots (e.g. internal panels like /locker, /fulfill)
    document.querySelectorAll('[data-lang-slot]').forEach(function (slot) {
      if (slot.querySelector('.lang-switch')) { placed++; return; }
      slot.appendChild(buildSwitch(lang, allowEs));
      placed++;
    });
    // Fallback: pages with no nav/menu/slot get a floating control so the
    // language option is always available (internal panels, etc.).
    if (placed === 0 && document.body) {
      var fsw = buildSwitch(lang, allowEs);
      fsw.classList.add('lang-switch--floating');
      document.body.appendChild(fsw);
    }
  }

  // Self-contained styling for the language switcher, so it looks correct even
  // on pages that don't load css/style.css (e.g. /locker, /fufill, /admin).
  function injectStyle() {
    if (document.getElementById('qm-i18n-style')) return;
    var css =
      '.lang-switch{position:relative;display:inline-flex;align-items:center;margin-right:.9rem}' +
      '.lang-switch-btn{display:inline-flex;align-items:center;gap:.32rem;background:none;border:none;padding:0;color:#fff;opacity:.9;font-family:inherit;font-size:.95rem;font-weight:500;letter-spacing:.01em;text-shadow:0 1px 8px rgba(0,0,0,.4);cursor:pointer;transition:opacity .2s}' +
      '.lang-switch-btn:hover{opacity:1}' +
      '.lang-switch-btn .lang-chevron{width:11px;height:11px;opacity:.85;transition:transform .2s}' +
      '.lang-switch.open .lang-switch-btn .lang-chevron{transform:rotate(180deg)}' +
      '.nav.nav-light .lang-switch-btn{color:#1a1611;text-shadow:none}' +
      '.lang-switch-menu{position:absolute;top:calc(100% + .5rem);right:0;min-width:150px;background:#fff;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.18);padding:.4rem;display:none;flex-direction:column;gap:.15rem;z-index:4001}' +
      '.lang-switch.open .lang-switch-menu{display:flex}' +
      '.lang-switch-menu button{text-align:left;background:none;border:none;border-radius:8px;padding:.6rem .8rem;font-family:inherit;font-size:.92rem;color:#1a1611;cursor:pointer;transition:background .12s}' +
      '.lang-switch-menu button:hover{background:#f0ece3}' +
      '.lang-switch-menu button.active{background:#273071;color:#fff;font-weight:600}' +
      '.mobile-menu .lang-switch{margin:.25rem 0 0}' +
      '.mobile-menu .lang-switch-btn{font-size:1.2rem;gap:.45rem;opacity:1}' +
      '.mobile-menu .lang-switch-btn .lang-chevron{width:14px;height:14px}' +
      '.mobile-menu .lang-switch-menu{right:auto;left:50%;transform:translateX(-50%)}' +
      '.lang-switch--floating{position:fixed;top:14px;right:14px;margin-right:0;z-index:4000}' +
      '.lang-switch--floating .lang-switch-btn{background:#273071;color:#fff;opacity:1;padding:.5rem .85rem;border-radius:999px;text-shadow:none;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
      '@media (max-width:768px){.nav .lang-switch{margin-right:.5rem}.nav .lang-switch-btn .lang-chevron{display:none}}';
    var st = document.createElement('style');
    st.id = 'qm-i18n-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    var lang = currentLang();
    // Spanish is offered ONLY inside the staff panels (locker / fufill / admin),
    // which are the pages that expose a [data-lang-slot]. On customer-facing
    // pages a stored 'es' falls back to Danish and the ES option isn't shown.
    var isStaff = !!document.querySelector('[data-lang-slot]');
    var effLang = (lang === 'es' && !isStaff) ? 'da' : lang;
    document.documentElement.lang = effLang;
    injectStyle();
    injectSwitches(effLang, isStaff);

    if (effLang !== 'da') {
      if (effLang === 'es') { ACTIVE_DICT = QM_DICT_ES; ACTIVE_RULES = QM_RULES_ES; }
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

  window.QuartzI18n = { lang: currentLang, set: setLang, t: function (s) {
    var l = currentLang();
    if (l === 'en' && QM_DICT[s]) return QM_DICT[s];
    if (l === 'es' && QM_DICT_ES[s]) return QM_DICT_ES[s];
    return s;
  } };
})();
