// ============================================================
// QUARTZ MØLLE — PRODUCT DATA
// ============================================================
// previewImage = the branded promo image shown in lists + as default product hero
// weight.image = the physical pack-shot shown when a size is selected
// nutrition = typical values per 100g for this variety
// NOTE: Nutrition values are typical stone-milled ranges. Replace with
// lab-verified values from your Quartz Mølle analyses when available.

const PRODUCTS = [
  {
    id: 'dalarna-fuldkorn',
    name: 'Dalarna',
    type: 'Fuldkornshvedemel',
    badge: 'gammel',
    color: '#c0392b',
    previewImage: 'images/dalarna_type85.png',
    description: 'Dalarna er en klassisk dansk hvedesort med en rig smag og god bageevne. Perfekt til rugbrød, boller og grovbrød. Dyrket og malet i Danmark.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1440 kJ / 343 kcal',
      fat: '2,3 g', saturated: '0,4 g',
      carbs: '62 g', sugars: '1,0 g',
      fiber: '11 g', protein: '13 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Dalarna-3Kg-fuldkorn-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/Dalarna-12_5Kg-fuldkorn-96x139mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'dalarna-type85',
    name: 'Dalarna',
    type: 'Mellemsigtet hvedemel – Type 85',
    badge: 'gammel',
    color: '#c0392b',
    previewImage: 'images/fuldkorn_dalarna.png',
    description: 'Dalarna Type 85 er et mellemsigtet mel der bevarer mere af kornets naturlige smag og næringsindhold end fintere mel. Ideel til brød med karakter.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1455 kJ / 347 kcal',
      fat: '1,8 g', saturated: '0,3 g',
      carbs: '67 g', sugars: '1,0 g',
      fiber: '8 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Dalarna-3Kg-type85-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/Dalarna-12_5Kg-type85-96x139mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'mariagertoba-type70',
    name: 'Mariagertoba',
    type: 'Fintsigtet hvedemel – Type 70',
    badge: 'bestseller',
    color: '#d4890a',
    previewImage: 'images/mariagertoba.png',
    description: 'Mariagertoba er et fintsigtet hvedemel med fremragende bageegenskaber. Det giver luftige og velsmagende brød og boller. En af vores mest elskede sorter.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1460 kJ / 348 kcal',
      fat: '1,5 g', saturated: '0,3 g',
      carbs: '70 g', sugars: '1,0 g',
      fiber: '5 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Mariagertoba-type70-3Kg-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/Mariagertoba-type70-12_5Kg-148x214_29mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'olands-fuldkorn',
    name: 'Ølands / Quarna',
    type: 'Fuldkornshvedemel',
    badge: 'gammel',
    color: '#5b8dd9',
    previewImage: 'images/olands_fuldkorn.png',
    description: 'Ølandshvede er en gammel nordisk kornsort med en kompleks og nøddeagtig smag. Perfekt til surdejsbrød og håndværkerbrød der kræver karakter.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1435 kJ / 342 kcal',
      fat: '2,4 g', saturated: '0,4 g',
      carbs: '61 g', sugars: '1,0 g',
      fiber: '11 g', protein: '13 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/OlandsHvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 300, image: 'images/OlandsHvede-fuldkorn-12_5Kg-148x214_29mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'olands-type85',
    name: 'Ølands / Quarna',
    type: 'Mellemsigtet hvedemel – Type 85',
    badge: 'gammel',
    color: '#5b8dd9',
    previewImage: 'images/olands_type85.png',
    description: 'Ølands Type 85 kombinerer det bedste fra fuldkorn og hvidt mel. En alsidig meltype der giver brød med dybde og god struktur.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1450 kJ / 345 kcal',
      fat: '1,8 g', saturated: '0,3 g',
      carbs: '66 g', sugars: '1,0 g',
      fiber: '8 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/OlandsHvede-type85-3Kg-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/OlandsHvede-type85-12_5Kg-148x214_29mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'purpurhvede-fuldkorn',
    name: 'Purpurhvede',
    type: 'Fuldkornshvedemel',
    badge: 'bestseller',
    color: '#7b2fbe',
    previewImage: 'images/purpurhvede.png',
    description: 'Purpurhvede er en smuk og sjælden hvedesort med en dyb, lilla farve. Rig på antioxidanter og med en markant, sødlig smag der løfter ethvert bagværk.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1440 kJ / 343 kcal',
      fat: '2,4 g', saturated: '0,4 g',
      carbs: '62 g', sugars: '1,0 g',
      fiber: '11 g', protein: '13 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 108, image: 'images/Purpurhvede-fuldkorn-3Kg-96x139mm-outlined_copy.jpg' },
      { label: '12,5 kg', price: 330, image: 'images/Purpurhvede-fuldkorn-12_5Kg-148x214_29mm-outlined_copy.jpg' }
    ]
  },
  {
    id: 'quartz-special-fuldkorn',
    name: 'Quartz Special',
    type: 'Fuldkornsmel',
    badge: null,
    color: '#2d6a4f',
    previewImage: 'images/qs_fuldkorn.png',
    description: 'Quartz Special er vores husets særlige blanding – en unik sammensætning af udvalgte kornsorter der giver et komplekst og smagfuldt fuldkornsmel.',
    certifications: ['DK-ØKO-100', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1440 kJ / 343 kcal',
      fat: '2,3 g', saturated: '0,4 g',
      carbs: '62 g', sugars: '1,0 g',
      fiber: '11 g', protein: '13 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 108, image: 'images/QS-Fuldkorn-3kg-Webshop.jpg' },
      { label: '12,5 kg', price: 330, image: 'images/QS-Fuldkorn-12_5_Webshop.jpg' }
    ]
  },
  {
    id: 'quartz-special-type85',
    name: 'Quartz Special',
    type: 'Mellemsigtet mel – Type 85',
    badge: null,
    color: '#2d6a4f',
    previewImage: 'images/qs_type85.png',
    description: 'Quartz Special Type 85 er vores husets mellemsigtede mel – en særlig blanding med fremragende bageegenskaber og en rig, kompleks smag.',
    certifications: ['DK-ØKO-100', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1455 kJ / 347 kcal',
      fat: '1,8 g', saturated: '0,3 g',
      carbs: '67 g', sugars: '1,0 g',
      fiber: '8 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 108, image: 'images/QS-Type85-3kg-Webshop.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/QS-Type85-12_5_Webshop.jpg' }
    ]
  },
  {
    id: 'rod-hvede-fuldkorn',
    name: 'Rød hvede',
    type: 'Fuldkornshvedemel',
    badge: null,
    color: '#c0392b',
    previewImage: 'images/rod_fuldkorn.png',
    description: 'Rød hvede er en klassisk dansk hvedesort med en smuk rødlig farve og en fyldig, robust smag. Ideel til grove brød og boller med karakter.',
    certifications: ['DK-ØKO-100', 'EU-Jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1440 kJ / 343 kcal',
      fat: '2,3 g', saturated: '0,4 g',
      carbs: '62 g', sugars: '1,0 g',
      fiber: '11 g', protein: '13 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Rod-Fuldkorn-3kg.jpg' },
      { label: '12,5 kg', price: 300, image: 'images/Rod-Fuldkorn-12_5.jpg' }
    ]
  },
  {
    id: 'rod-hvede-type70',
    name: 'Rød hvede',
    type: 'Fintsigtet hvedemel – Type 70',
    badge: 'bestseller',
    color: '#c0392b',
    previewImage: 'images/rod_type70.png',
    description: 'Rød hvede Type 70 er et let sigtet mel der giver luftige og velsmagende brød. Perfekt når du ønsker det bedste fra rød hvede i en finere tekstur.',
    certifications: ['DK-ØKO-100', 'EU-Jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1460 kJ / 348 kcal',
      fat: '1,5 g', saturated: '0,3 g',
      carbs: '70 g', sugars: '1,0 g',
      fiber: '5 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Rod-Type70-3kg.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/Rod-Type70-12_5.jpg' }
    ]
  },
  {
    id: 'rod-hvede-type85',
    name: 'Rød hvede',
    type: 'Mellemsigtet hvedemel – Type 85',
    badge: null,
    color: '#c0392b',
    previewImage: 'images/rod_type85.png',
    description: 'Rød hvede Type 85 er det perfekte kompromis mellem fuldkorn og finere mel. Beholder kornets naturlige smag med en mere tilgængelig tekstur.',
    certifications: ['DK-ØKO-100', 'EU-Jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1455 kJ / 347 kcal',
      fat: '1,8 g', saturated: '0,3 g',
      carbs: '67 g', sugars: '1,0 g',
      fiber: '8 g', protein: '12 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 99, image: 'images/Rod-Type85-3kg.jpg' },
      { label: '12,5 kg', price: 315, image: 'images/Rod-Type85-12_5.jpg' }
    ]
  },
  {
    id: 'rug-fuldkorn',
    name: 'Rug',
    type: 'Rugmel fuldkorn',
    badge: 'bestseller',
    color: '#4a7c59',
    previewImage: 'images/ruggreen_fuldkorn.png',
    description: 'Vores rugmel er malet af hele rugkerner på stenkværn. Rig på fibre og med en dyb, jordnær smag der er uundværlig i det klassiske danske rugbrød.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Dyrket i Danmark & malet på stenkværn',
    nutrition: {
      energy: '1340 kJ / 320 kcal',
      fat: '2,0 g', saturated: '0,3 g',
      carbs: '58 g', sugars: '1,5 g',
      fiber: '14 g', protein: '9 g',
      salt: '0,02 g'
    },
    weights: [
      { label: '3 kg', price: 85, image: 'images/RugGreen-3Kg-fuldkorn-96x139mm-outlined.jpg' },
      { label: '11 kg', price: 250, image: 'images/RugGreen-11Kg-fuldkorn-96x139mm-outlined.jpg' }
    ]
  },
  {
    id: 'spelt-fuldkorn',
    name: 'Spelt',
    type: 'Fuldkornsmel',
    badge: null,
    color: '#6b6b6b',
    previewImage: 'images/spelt_fuldkorn.png',
    description: 'Spelt er en urgammel kornsort med en nøddeagtig, sødlig smag. Lettere fordøjeligt end hvede og perfekt til brød, kager og pasta med en særlig karakter.',
    certifications: ['DK-ØKO-100', 'Dansk jordbrug', 'EU-jordbrug', 'Statskontrolleret Økologisk'],
    origin: 'Malet på stenkværn i Danmark',
    nutrition: {
      energy: '1420 kJ / 339 kcal',
      fat: '2,5 g', saturated: '0,4 g',
      carbs: '60 g', sugars: '1,5 g',
      fiber: '10 g', protein: '14 g',
      salt: '0,01 g'
    },
    weights: [
      { label: '3 kg', price: 108, image: 'images/Spelt-fuldkorn-3kg-Webshop.jpg' },
      { label: '12,5 kg', price: 330, image: 'images/Spelt-fuldkorn-12_5_Webshop.jpg' }
    ]
  }
];

// Bestsellers for homepage
const BESTSELLERS = PRODUCTS.filter(p => p.badge === 'bestseller').slice(0, 4);
