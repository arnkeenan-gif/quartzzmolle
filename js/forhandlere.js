// ============================================================
// QUARTZ MØLLE — FORHANDLERE MAP
// ============================================================

const FORHANDLERE = [
  { name: "Simple Surdej", address: "Fischers Pl. 2b, 8800 Viborg", url: "https://www.simpelsurdej.dk/collections/flour", lat: 56.4485394, lng: 9.4070215 },
  { name: "Cathrine Brandt", address: "Søtorvet 17, 8600 Silkeborg", url: "https://cathrinebrandtbutik.dk/collections/ravarer", lat: 56.17129, lng: 9.5538 },
  { name: "Tír Bakery", address: "Gnibenvej 13, Yderby Lyng, 4583 Sjællands Odde", url: "https://www.instagram.com/tir_bakery/?hl=da", lat: 55.98526, lng: 11.30186 },
  { name: "groft", address: "Strandvejen 34, 8300 Odder", url: "https://groft.dk/", lat: 55.97487, lng: 10.229 },
  { name: "Sara Gade", address: "Stensbyvej 28B, 4773 Stensved", url: "https://saragade.dk/", lat: 54.980806, lng: 12.045917 },
  { name: "Søtofte Gårdmejeri", address: "Søtoftevej 74, 4100 Ringsted", url: "https://www.xn--stoftegrdmejeri-nlb03a.dk/", lat: 55.513046, lng: 11.688422 },
  { name: "Kløverbakken Gårdbutik", address: "Skelbyvej 32, 4160 Herlufmagle", url: "https://kloverbakken.dk/", lat: 55.3126648, lng: 11.684474 },
  { name: "Louie & Venner", address: "Østergade 5, 4581 Rørvig", url: "https://www.louieogvenner.dk/", lat: 55.942083, lng: 11.753056 },
  { name: "Kasada", address: "Strandlodsvej 11e, 2300 København S", url: "https://kasada.dk/", lat: 55.6659849, lng: 12.6214753 },
  { name: "Fanes Brød", address: "Fanefjordgade 119, 4792 Askeby", url: "https://www.instagram.com/fanesbroed/?__d=1", lat: 54.917421, lng: 12.168759 },
  { name: "Albatross & Venner", address: "Torvehallerne, Hal 2, Linnésgade 17, 1361 København K", url: "https://www.albatrossogvenner.dk/", lat: 55.683678, lng: 12.569614 },
  { name: "Surdejsrosen", address: "Bygaden 23B, 9430 Vadum", url: "https://www.instagram.com/surdejsrosen/", lat: 57.152806, lng: 9.875639 },
  { name: "Hundredefemten", address: "Brøndbakvej 115, 9740 Jerslev", url: "https://hundredefemten.dk/", lat: 57.2686186, lng: 10.2107915 },
  { name: "BYENS LANDHANDEL", address: "Ægirsgade 19, 2200 København N", url: "https://byenslandhandel.dk/collections/mel-gryn-kerner", lat: 55.698466, lng: 12.545081 },
  { name: "Hegnsholt", address: "Lejrevej 52a, 4320 Lejre", url: "https://www.hegnsholt.net/", lat: 55.58921, lng: 11.968064 },
  { name: "Kvickly Odder", address: "Nørregade 6, 8300 Odder", url: "https://kvicklyodder.dk/", lat: 55.974517, lng: 10.14865 },
  { name: "SPAR Klitmøller", address: "Ørhagevej 71, 7700 Thisted", url: "https://spar.dk/butik/spar-klitmoeller", lat: 57.039837, lng: 8.498125 },
  { name: "Basseralle", address: "Labæk 17, 4300 Holbæk", url: "https://www.facebook.com/profile.php?id=100092175408507", lat: 55.716995, lng: 11.718014 },
  { name: "Vernholt", address: "Strib Landevej 108, 5500 Middelfart", url: "https://vernholt.dk/collections/mel", lat: 55.511472, lng: 9.785575 },
  { name: "Kornets Butik", address: "Søndergade 9, 9800 Hjørring", url: "https://www.facebook.com/profile.php?id=100057095304700&locale=da_DK", lat: 57.459686, lng: 9.984905 },
  { name: "Kornets Hus", address: "Guldagervej 501, 9800 Hjørring", url: "https://kornetshus.dk/", lat: 57.407011, lng: 10.018914 },
  { name: "Jordnær", address: "Gadeledsvej 7, 3400 Hillerød", url: "https://koebmandjordnaer.dk/", lat: 55.96489, lng: 12.282814 },
  { name: "Vivis Pryd", address: "Toftehøj 3, 4160 Herlufmagle", url: "https://www.facebook.com/VivisPryd", lat: 55.340347, lng: 11.748884 },
  { name: "Skipper Bageri", address: "Østerbrogade 103, 2100 København Ø", url: "https://www.facebook.com/profile.php?id=100086046094539", lat: 55.709675, lng: 12.577206 },
  { name: "Max von Haps", address: "Holmetoften 13, 2970 Hørsholm", url: "https://maxvonhaps.dk/", lat: 55.896448, lng: 12.489905 },
  { name: "Den lille Brødbutik", address: "Olinesmindevej 28, 8722 Hedensted", url: "https://www.facebook.com/p/Den-lille-br%C3%B8dbutik-61579862740957/", lat: 55.767939, lng: 9.683159 },
  { name: "UNObanegaard", address: "Banegårdspladsen 8, 9800 Hjørring", url: "https://unobanegaard.dk/", lat: 57.45661, lng: 9.985979 },
  { name: "Tinghuset", address: "Rådhusgade 1, 8300 Odder", url: "https://www.tinghusetodder.dk/", lat: 55.972795, lng: 10.149364 },
  { name: "MadRum", address: "Egebjergvej 1, 8751 Gedved", url: "https://www.madrum.dk/", lat: 55.934674, lng: 9.844491 },
  { name: "Bastard Brød", address: "Bjerndrup Bygade 18, 6200 Bjerndrup", url: "https://www.instagram.com/bastardbroed/", lat: 54.932677, lng: 9.329129 },
  { name: "Café Chino", address: "Brandts Passage 6, 5000 Odense", url: "https://cafechino.dk/", lat: 55.394959, lng: 10.381514 },
  { name: "ELSK Kiosk", address: "Storegade 10a, 7700 Thisted", url: "https://elsk.com/", lat: 56.954647, lng: 8.692747 },
  { name: "Det Lille Hus på Landet", address: "Axeltorv 6B, 4700 Næstved", url: "https://www.detlillehuspaalandet.net/", lat: 55.22976, lng: 11.76189 },
  { name: "TIR Bakery", address: "Vodroffsvej 28, 1900 Frederiksberg", url: "https://www.instagram.com/tir_bakery/?hl=da", lat: 55.67862456701327, lng: 12.555211502320596 },
  { name: "Engmosegaard", address: "Sverkilstrup Byvej 8, 3390 Hundested", url: "https://www.instagram.com/engmosegaard/", lat: 55.97294416025783, lng: 11.940071172126022 },
  { name: "Gaard Bageriet", address: "Agerøvej 14, V. Hvidbjerg, 7960 Karby", url: "https://gaardbageriet.dk/", lat: 56.7389716, lng: 8.5889263 }
];

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('forhandlere-map');
  if (!mapEl || typeof L === 'undefined') return;

  // Center on Denmark, fit all points after load
  const map = L.map('forhandlere-map', {
    center: [56.0, 10.5],
    zoom: 7,
    scrollWheelZoom: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Custom icon using the Quartz Mølle logo
  const qIcon = L.divIcon({
    className: '',
    html: '<div class="q-marker"><img src="images/logopng.png" alt=""></div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -20]
  });

  // Cluster group uses a numbered badge in brand blue so "stacked" pins are obvious
  const cluster = L.markerClusterGroup({
    iconCreateFunction: (c) => L.divIcon({
      className: '',
      html: `<div class="q-cluster">${c.getChildCount()}</div>`,
      iconSize: [48, 48]
    }),
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 45
  });

  const markers = [];

  FORHANDLERE.forEach(f => {
    const marker = L.marker([f.lat, f.lng], { icon: qIcon });
    marker.bindPopup(`
      <strong>${escapeHTML(f.name)}</strong>
      <div>${escapeHTML(f.address)}</div>
      <a href="${escapeHTML(f.url)}" target="_blank" rel="noopener">Besøg hjemmeside →</a>
    `);
    cluster.addLayer(marker);
    markers.push(marker);
  });

  map.addLayer(cluster);

  // Fit the viewport to include every forhandler
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.15));
});
