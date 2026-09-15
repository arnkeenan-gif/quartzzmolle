// api/_catalog.js — Authoritative server-side product catalog.
//
// Files in api/ that start with "_" are NOT deployed as serverless functions,
// so this is a shared helper (does not count toward the function limit).
//
// This mirrors the prices in js/products.js and is the SOURCE OF TRUTH the
// checkout endpoint uses — client-supplied prices are never trusted.
// Prices are in DKK (kroner). Keys are the product id + exact weight label.

export const CATALOG = {
  'mariagertoba-type70':   { name: "Mariagertoba", type: "Fintsigtet hvedemel – Type 70", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'dalarna-type85':        { name: "Dalarna", type: "Mellemsigtet hvedemel – Type 85", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'dalarna-fuldkorn':      { name: "Dalarna", type: "Fuldkornshvedemel", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'olands-fuldkorn':       { name: "Ølands / Quarna", type: "Fuldkornshvedemel", weights: { '3 kg': 99,  '12,5 kg': 300 } },
  'olands-type85':         { name: "Ølands / Quarna", type: "Mellemsigtet hvedemel – Type 85", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'purpurhvede-fuldkorn':  { name: "Purpurhvede", type: "Fuldkornshvedemel", weights: { '3 kg': 108, '12,5 kg': 330 } },
  'rod-hvede-fuldkorn':    { name: "Rød hvede", type: "Fuldkornshvedemel", weights: { '3 kg': 99,  '12,5 kg': 300 } },
  'rod-hvede-type70':      { name: "Rød hvede", type: "Fintsigtet hvedemel – Type 70", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'rod-hvede-type85':      { name: "Rød hvede", type: "Mellemsigtet hvedemel – Type 85", weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'rug-fuldkorn':          { name: "Rug", type: "Rugmel fuldkorn", weights: { '3 kg': 85,  '11 kg': 250 } },
  'spelt-fuldkorn':        { name: "Spelt", type: "Fuldkornsmel", weights: { '3 kg': 108, '12,5 kg': 330 } },
  'bla-hvede-fuldkorn':    { name: "Blå hvede", type: "Fuldkornshvedemel", weights: { '3 kg': 122, '12,5 kg': 350 } },
};


// Label-billederne (etiketten, ikke posefotoet). Bruges til Stripe-checkout,
// kvitteringen og admin, hvor etiketten er tydeligere end et foto af posen.
// Nøglen er `${id}|${vægt}` — samme form som prismappet.
export const LABEL_IMAGES = {
  "mariagertoba-type70|3 kg": "images/Mariagertoba-type70-3Kg-96x139mm-outlined_copy.jpg",
  "mariagertoba-type70|12,5 kg": "images/Mariagertoba-type70-12_5Kg-148x214_29mm-outlined_copy.jpg",
  "dalarna-type85|3 kg": "images/Dalarna-3Kg-type85-96x139mm-outlined_copy.jpg",
  "dalarna-type85|12,5 kg": "images/Dalarna-12_5Kg-type85-96x139mm-outlined_copy.jpg",
  "dalarna-fuldkorn|3 kg": "images/Dalarna-3Kg-fuldkorn-96x139mm-outlined_copy.jpg",
  "dalarna-fuldkorn|12,5 kg": "images/Dalarna-12_5Kg-fuldkorn-96x139mm-outlined_copy.jpg",
  "olands-fuldkorn|3 kg": "images/OlandsHvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg",
  "olands-fuldkorn|12,5 kg": "images/OlandsHvede-fuldkorn-12_5Kg-148x214_29mm-outlined_copy.jpg",
  "olands-type85|3 kg": "images/OlandsHvede-type85-3Kg-96x139mm-outlined_copy.jpg",
  "olands-type85|12,5 kg": "images/OlandsHvede-type85-12_5Kg-148x214_29mm-outlined_copy.jpg",
  "purpurhvede-fuldkorn|3 kg": "images/Purpurhvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg",
  "purpurhvede-fuldkorn|12,5 kg": "images/Purpurhvede-fuldkorn-12_5Kg-148x214_29mm-outlined_copy.jpg",
  "rod-hvede-fuldkorn|3 kg": "images/Rod-Fuldkorn-3kg.jpg",
  "rod-hvede-fuldkorn|12,5 kg": "images/Rod-Fuldkorn-12_5.jpg",
  "rod-hvede-type70|3 kg": "images/Rod-Type70-3kg.jpg",
  "rod-hvede-type70|12,5 kg": "images/Rod-Type70-12_5.jpg",
  "rod-hvede-type85|3 kg": "images/Rod-Type85-3kg.jpg",
  "rod-hvede-type85|12,5 kg": "images/Rod-Type85-12_5.jpg",
  "rug-fuldkorn|3 kg": "images/RugGreen-3Kg-fuldkorn-96x139mm-outlined.jpg",
  "rug-fuldkorn|11 kg": "images/RugGreen-11Kg-fuldkorn-96x139mm-outlined.jpg",
  "spelt-fuldkorn|3 kg": "images/Spelt-fuldkorn-3kg-Webshop.jpg",
  "spelt-fuldkorn|12,5 kg": "images/Spelt-fuldkorn-12_5_Webshop.jpg",
  "bla-hvede-fuldkorn|3 kg": "images/blaahvede_3kg.jpg",
  "bla-hvede-fuldkorn|12,5 kg": "images/blaahvede_12_5kg.jpg",
};

// Etiketten for en vare. Falder tilbage til produktets første etiket,
// hvis en vægt mangler, så der altid er et billede.
export function labelImage(id, label) {
  const exact = LABEL_IMAGES[`${id}|${label}`];
  if (exact) return exact;
  const prefix = `${id}|`;
  for (const [k, v] of Object.entries(LABEL_IMAGES)) if (k.startsWith(prefix)) return v;
  return null;
}

// Parse the kg value from a weight label like "12,5 kg" -> 12.5
export function weightKgFromLabel(label) {
  const m = String(label || '').match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? (parseFloat(m[1].replace(',', '.')) || 0) : 0;
}

// Build the authoritative price map: `${productId}|${weightLabel}` -> price (kr).
// Starts from the static catalog above, then applies any overrides coming from
// Supabase (same source the shop page merges), so legitimately updated prices
// still pass while manipulated client prices are rejected.
export function buildPriceMap(dbProducts) {
  const map = {};
  for (const [id, p] of Object.entries(CATALOG)) {
    for (const [label, price] of Object.entries(p.weights)) {
      map[`${id}|${label}`] = price;
    }
  }
  if (Array.isArray(dbProducts)) {
    for (const row of dbProducts) {
      if (row && row.id && Array.isArray(row.weights)) {
        for (const w of row.weights) {
          if (w && typeof w.label === 'string' && typeof w.price === 'number' && w.price >= 0) {
            map[`${row.id}|${w.label}`] = w.price;
          }
        }
      }
    }
  }
  return map;
}
