/**
 * Fetch construction-related products from homecenter.co.il (Shopify API)
 *
 * Categories fetched:
 *   - building-materials (חומרי בנייה)
 *   - tools (כלי עבודה)
 *   - paints (צבעים)
 *   - plumbing (אינסטלציה)
 *   - electrical (חשמל)
 *   - iron-and-metal (ברזל ומתכת)
 *
 * Output: products.json — array of { name, vendor, type, category, price, sku, unit }
 */

const OUTPUT_FILE = new URL('./output/products.json', import.meta.url).pathname;

// Shopify collections on homecenter.co.il that are relevant to construction
const COLLECTIONS = [
  { slug: 'building-materials', category: 'חומרי בנייה' },
  { slug: 'khvmry-bnyh', category: 'חומרי בנייה' },
  { slug: 'tools', category: 'כלי עבודה' },
  { slug: 'paints', category: 'צבעים' },
  { slug: 'plumbing', category: 'אינסטלציה' },
  { slug: 'electrical', category: 'חשמל' },
  { slug: 'doors-and-windows', category: 'דלתות וחלונות' },
  { slug: 'ceramics-and-flooring', category: 'ריצוף וחיפוי' },
  { slug: 'screws-and-fasteners', category: 'ברגים ומחברים' },
  { slug: 'adhesives-and-sealants', category: 'דבקים ואיטום' },
  { slug: 'lighting', category: 'תאורה' },
  { slug: 'garden', category: 'גינה' },
];

interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  variants: { price: string; sku: string; weight: number; weight_unit: string }[];
}

interface Product {
  name: string;
  vendor: string;
  type: string;
  category: string;
  price: number | null;
  sku: string;
  unit: string;
}

function inferUnit(product: ShopifyProduct): string {
  const title = product.title.toLowerCase();
  const type = product.product_type.toLowerCase();
  const combined = `${title} ${type}`;

  if (/מ"ר|מטר מרובע|sqm/.test(combined)) return 'מ"ר';
  if (/מטר|מ'|מ"א/.test(combined)) return 'מטר';
  if (/ק"ג|קילו|kg/.test(combined)) return 'ק"ג';
  if (/ליטר|לי?ט|ml|מ"ל/.test(combined)) return 'ליטר';
  if (/שק|שקית/.test(combined)) return 'שק';
  if (/חבילה|חב'|pack/.test(combined)) return 'חבילה';
  if (/גליל|רול/.test(combined)) return 'גליל';
  if (/קופסה|קופ'/.test(combined)) return 'קופסה';
  return 'יחידות';
}

async function fetchCollection(slug: string): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let page = 1;
  const maxPages = 10; // safety limit

  while (page <= maxPages) {
    const url = `https://www.homecenter.co.il/collections/${slug}/products.json?limit=250&page=${page}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const json = await res.json();
      if (!json.products || json.products.length === 0) break;
      products.push(...json.products);
      if (json.products.length < 250) break;
      page++;
    } catch {
      break;
    }
  }

  return products;
}

async function main() {
  console.log('Fetching products from homecenter.co.il...\n');

  const allProducts = new Map<number, Product>();
  const vendorSet = new Set<string>();
  const typeSet = new Set<string>();

  for (const { slug, category } of COLLECTIONS) {
    process.stdout.write(`  ${category} (${slug})...`);
    try {
      const raw = await fetchCollection(slug);
      let added = 0;

      for (const p of raw) {
        if (allProducts.has(p.id)) continue;

        const variant = p.variants?.[0];
        const price = variant?.price ? parseFloat(variant.price) : null;

        allProducts.set(p.id, {
          name: p.title.trim(),
          vendor: p.vendor?.trim() || '',
          type: p.product_type?.trim() || '',
          category,
          price: price && price > 0 ? price : null,
          sku: variant?.sku?.trim() || '',
          unit: inferUnit(p),
        });

        if (p.vendor) vendorSet.add(p.vendor.trim());
        if (p.product_type) typeSet.add(p.product_type.trim());
        added++;
      }

      console.log(` ${added} מוצרים`);
    } catch (err) {
      console.log(` FAILED: ${err}`);
    }

    // small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  const products = [...allProducts.values()];

  // Sort by category then name
  products.sort((a, b) => a.category.localeCompare(b.category, 'he') || a.name.localeCompare(b.name, 'he'));

  // Write output
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.dirname(OUTPUT_FILE);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));

  console.log(`\nDone! ${products.length} unique products → ${OUTPUT_FILE}`);
  console.log(`\nVendors (${vendorSet.size}):`);
  for (const v of [...vendorSet].sort((a, b) => a.localeCompare(b, 'he'))) {
    console.log(`  ${v}`);
  }
  console.log(`\nProduct types (${typeSet.size}):`);
  for (const t of [...typeSet].sort((a, b) => a.localeCompare(b, 'he'))) {
    console.log(`  ${t}`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
