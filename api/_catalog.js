// api/_catalog.js — Authoritative server-side product catalog.
//
// Files in api/ that start with "_" are NOT deployed as serverless functions,
// so this is a shared helper (does not count toward the function limit).
//
// This mirrors the prices in js/products.js and is the SOURCE OF TRUTH the
// checkout endpoint uses — client-supplied prices are never trusted.
// Prices are in DKK (kroner). Keys are the product id + exact weight label.

export const CATALOG = {
  'mariagertoba-type70': { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'dalarna-type85':      { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'dalarna-fuldkorn':    { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'olands-fuldkorn':     { weights: { '3 kg': 99,  '12,5 kg': 300 } },
  'olands-type85':       { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'purpurhvede-fuldkorn':{ weights: { '3 kg': 108, '12,5 kg': 330 } },
  'rod-hvede-fuldkorn':  { weights: { '3 kg': 99,  '12,5 kg': 300 } },
  'rod-hvede-type70':    { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'rod-hvede-type85':    { weights: { '3 kg': 99,  '12,5 kg': 315 } },
  'rug-fuldkorn':        { weights: { '3 kg': 85,  '11 kg': 250 } },
  'spelt-fuldkorn':      { weights: { '3 kg': 108, '12,5 kg': 330 } },
};

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
