# Quartz Mølle Webshop

Økologisk mel fra stenkværn — built with vanilla HTML/CSS/JS + Supabase + Stripe.

## 🚀 Deploy til Vercel

### 1. Push til GitHub
```bash
git init
git add .
git commit -m "Initial Quartz Mølle webshop"
git remote add origin https://github.com/DIT-BRUGERNAVN/quartzmolle.git
git push -u origin main
```

### 2. Forbind til Vercel
1. Gå til [vercel.com](https://vercel.com)
2. Klik "Add New Project"
3. Import dit GitHub repo
4. Klik Deploy

### 3. Tilføj Environment Variables i Vercel
Gå til Project → Settings → Environment Variables og tilføj:

| Variable | Værdi |
|---|---|
| `STRIPE_SECRET_KEY` | Din Stripe secret key (sk_test_... eller sk_live_...) |

### 4. Skift til Live Stripe (når klar)
I `js/product.js` — skift `STRIPE_KEY` til din `pk_live_...` nøgle.
I Vercel Environment Variables — skift `STRIPE_SECRET_KEY` til `sk_live_...`.

---

## 📁 Filstruktur

```
quartzmolle/
├── index.html          # Forside med video baggrunde
├── shop.html           # Alle produkter
├── product.html        # Produktside med vægt-vælger
├── success.html        # Bekræftelse efter køb
├── css/
│   └── style.css       # Al styling
├── js/
│   ├── products.js     # Produktdata (rediger her for at tilføje)
│   ├── main.js         # Navigation, scroll, animations
│   ├── shop.js         # Shop side + Supabase integration
│   └── product.js      # Produktside + Stripe checkout
├── api/
│   └── checkout.js     # Vercel serverless → Stripe
├── images/             # Alle produktbilleder + logo
├── videos/             # Baggrundsvideo (hero.mov, middle.mov, bottom.mov)
├── vercel.json         # Vercel konfiguration
└── package.json        # Dependencies
```

---

## ➕ Tilføj et nyt produkt

**Metode 1 — Rediger kode (nemmest):**
Åbn `js/products.js` og tilføj et nyt objekt til `PRODUCTS` arrayet.

**Metode 2 — Via Supabase (anbefales til fremtiden):**
1. Gå til Supabase dashboard
2. Opret tabel `products` med kolonnerne: `id, name, type, badge, description, weights, certifications`
3. Tilføj produkter direkte i Supabase — siden henter automatisk

---

## 🎥 Videoer
Placer videoer i `/videos/` mappen:
- `hero.mov` — Øverste sektion
- `middle.mov` — Midterste sektion  
- `bottom.mov` — Nederste sektion

MOV og MP4 understøttes begge.

---

## 💳 Stripe Test Kort
Brug disse kortnumre til at teste checkout:
- `4242 4242 4242 4242` — Vellykket betaling
- `4000 0000 0000 9995` — Afvist kort
- Udløbsdato: hvilken som helst fremtidig dato
- CVC: tre vilkårlige tal
