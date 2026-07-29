import fs from 'fs';

const BASE_URL = 'https://guz-pro.co.il/wp-json/wc/store/v1/products';
const PER_PAGE = 100;

const PRICE_RANGES = {
  'חדר שירותיים': { min: 150, max: 800 },
  'חדר רחצה': { min: 400, max: 5000 },
  'מטבח': { min: 500, max: 3000 },
  'אביזרים': { min: 100, max: 900 },
  'נכים': { min: 300, max: 2000 },
  'SALE': { min: 200, max: 2000 },
};

const NAME_PRICE_HINTS = [
  { pattern: /אמבטיה.*FREESTAND/i, min: 9000, max: 15000 },
  { pattern: /אמבטיה/i, min: 2500, max: 5000 },
  { pattern: /אגנית.*פינתית/i, min: 1200, max: 1800 },
  { pattern: /אגנית/i, min: 600, max: 1400 },
  { pattern: /סט מטבח/i, min: 1500, max: 2500 },
  { pattern: /כיור.*מטבח.*כפול.*גרניט/i, min: 1800, max: 3500 },
  { pattern: /כיור.*מטבח.*גרניט/i, min: 1200, max: 2500 },
  { pattern: /כיור.*מטבח.*כפול/i, min: 1000, max: 2000 },
  { pattern: /כיור.*מטבח/i, min: 600, max: 1500 },
  { pattern: /כיור.*סלופסינק/i, min: 2000, max: 4000 },
  { pattern: /כיור.*תלוי.*נכים/i, min: 1500, max: 3000 },
  { pattern: /כיור.*תלוי/i, min: 1200, max: 2800 },
  { pattern: /כיור.*מונח/i, min: 900, max: 2200 },
  { pattern: /כיור.*תחתונה/i, min: 1500, max: 3000 },
  { pattern: /ברז.*מטבח.*נשלף/i, min: 900, max: 1500 },
  { pattern: /ברז.*נכים/i, min: 700, max: 1200 },
  { pattern: /ברז.*קיר/i, min: 700, max: 1100 },
  { pattern: /ברז/i, min: 500, max: 1000 },
  { pattern: /אסלה.*RIMLESS.*נכים/i, min: 2500, max: 4000 },
  { pattern: /אסלה.*RIMLESS/i, min: 1800, max: 3500 },
  { pattern: /אסלה.*נכים/i, min: 2000, max: 3500 },
  { pattern: /אסלה/i, min: 1200, max: 3000 },
  { pattern: /מונובלוק/i, min: 1500, max: 3000 },
  { pattern: /מושב.*אסלה/i, min: 300, max: 700 },
  { pattern: /לחצן.*אנטי.*ונדלי/i, min: 350, max: 600 },
  { pattern: /לחצן.*נירוסטה/i, min: 280, max: 500 },
  { pattern: /לחצן/i, min: 120, max: 350 },
  { pattern: /מיכל הדחה/i, min: 400, max: 700 },
  { pattern: /דיספנסר.*ג'ל/i, min: 400, max: 600 },
  { pattern: /דיספנסר.*אנכי/i, min: 380, max: 550 },
  { pattern: /דיספנסר/i, min: 250, max: 450 },
  { pattern: /מתקן.*משולב/i, min: 700, max: 1100 },
  { pattern: /מתקן.*ניירר.*כיסוי/i, min: 150, max: 250 },
  { pattern: /מתקן.*ניירר.*צץ.*רץ.*נירוסטה/i, min: 400, max: 650 },
  { pattern: /מתקן.*ניירר.*צץ.*רץ/i, min: 200, max: 400 },
  { pattern: /מתקן.*ניירות.*גלילי/i, min: 180, max: 350 },
  { pattern: /מתקן.*ניגוב.*נירוסטה/i, min: 400, max: 650 },
  { pattern: /מתקן.*ניגוב/i, min: 200, max: 450 },
  { pattern: /פח.*תלוי/i, min: 350, max: 550 },
  { pattern: /פח.*פדל.*5/i, min: 200, max: 350 },
  { pattern: /פח.*פדל.*3/i, min: 150, max: 280 },
  { pattern: /פח/i, min: 150, max: 400 },
  { pattern: /שוט.*אשפה/i, min: 120, max: 250 },
  { pattern: /מראה.*מגדילה/i, min: 350, max: 600 },
  { pattern: /מברשת.*אסלה/i, min: 180, max: 380 },
  { pattern: /מאחז.*זווייתי/i, min: 250, max: 450 },
  { pattern: /מאחז/i, min: 150, max: 350 },
  { pattern: /ראש.*טוש.*30/i, min: 500, max: 900 },
  { pattern: /ראש.*טוש.*25/i, min: 400, max: 750 },
  { pattern: /ראש.*טוש/i, min: 300, max: 600 },
  { pattern: /מוט.*מגבת/i, min: 200, max: 400 },
  { pattern: /מדף.*מגבות/i, min: 250, max: 500 },
  { pattern: /אביק.*אוטומטי/i, min: 300, max: 450 },
  { pattern: /אביק/i, min: 250, max: 400 },
  { pattern: /רגלי.*תמיכה/i, min: 200, max: 350 },
  { pattern: /סיפון/i, min: 80, max: 200 },
];

function generatePrice(name, categories) {
  for (const hint of NAME_PRICE_HINTS) {
    if (hint.pattern.test(name)) {
      return Math.round((hint.min + Math.random() * (hint.max - hint.min)) / 10) * 10;
    }
  }
  const cat = categories?.[0] || 'אביזרים';
  const range = PRICE_RANGES[cat] || { min: 200, max: 1000 };
  return Math.round((range.min + Math.random() * (range.max - range.min)) / 10) * 10;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAllProducts() {
  let page = 1;
  let allProducts = [];

  while (true) {
    const url = `${BASE_URL}?per_page=${PER_PAGE}&page=${page}`;
    console.log(`Fetching page ${page}...`);

    const res = await fetch(url);
    if (!res.ok) {
      console.log(`Page ${page} returned ${res.status}, stopping.`);
      break;
    }

    const products = await res.json();
    if (!products.length) {
      console.log('No more products.');
      break;
    }

    for (const p of products) {
      const categoryNames = (p.categories || []).map(c => c.name);
      let rawPrice = p.prices?.price ? parseInt(p.prices.price) : 0;
      // WC Store API returns prices in minor units (agorot). Convert to ILS.
      let price = rawPrice > 0 ? Math.round(rawPrice / 100) : 0;
      // If price is missing or unreasonably low, generate one
      if (price < 50) {
        price = generatePrice(p.name, categoryNames);
      }

      allProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        price,
        currency: 'ILS',
        description: stripHtml(p.short_description || p.description || ''),
        categories: categoryNames,
        images: (p.images || []).map(img => img.src || img),
      });
    }

    console.log(`  Got ${products.length} products (total: ${allProducts.length})`);
    page++;
  }

  return allProducts;
}

const products = await fetchAllProducts();
fs.writeFileSync('guz-pro-products.json', JSON.stringify(products, null, 2), 'utf8');
console.log(`\nDone! Saved ${products.length} products to guz-pro-products.json`);
