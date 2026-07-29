/**
 * Fetch all Israeli cities/settlements from data.gov.il
 * Source: Central Bureau of Statistics (CBS)
 * API: https://data.gov.il/api/3/action/datastore_search
 *
 * Output: cities.json — clean array of { name, englishName, district, code }
 */

const API_URL = 'https://data.gov.il/api/3/action/datastore_search';
const RESOURCE_ID = 'b7cf8f14-64a2-4b33-8d4b-edb286fdbd37';
const BATCH_SIZE = 500;
const OUTPUT_FILE = new URL('./output/cities.json', import.meta.url).pathname;

interface RawRecord {
  _id: number;
  סמל_ישוב: number;
  שם_ישוב: string;
  שם_ישוב_לועזי: string;
  שם_נפה: string;
  שם_מועצה: string;
}

interface City {
  code: number;
  name: string;
  englishName: string;
  district: string;
  council: string;
}

const clean = (s: string) => s?.trim() || '';

async function fetchBatch(offset: number): Promise<{ records: RawRecord[]; total: number }> {
  const url = `${API_URL}?resource_id=${RESOURCE_ID}&limit=${BATCH_SIZE}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { records: json.result.records, total: json.result.total };
}

async function main() {
  console.log('Fetching Israeli cities from data.gov.il...');

  const allRecords: RawRecord[] = [];
  let offset = 0;
  let total = 0;

  do {
    const batch = await fetchBatch(offset);
    total = batch.total;
    allRecords.push(...batch.records);
    offset += BATCH_SIZE;
    console.log(`  Fetched ${allRecords.length}/${total}`);
  } while (offset < total);

  // Clean and deduplicate
  const seen = new Set<number>();
  const cities: City[] = [];

  for (const r of allRecords) {
    const code = r.סמל_ישוב;
    if (seen.has(code)) continue;
    seen.add(code);

    const name = clean(r.שם_ישוב);
    if (!name) continue;

    cities.push({
      code,
      name,
      englishName: clean(r.שם_ישוב_לועזי),
      district: clean(r.שם_נפה),
      council: clean(r.שם_מועצה),
    });
  }

  // Sort by Hebrew name
  cities.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  // Write output
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.dirname(OUTPUT_FILE);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cities, null, 2));

  console.log(`\nDone! ${cities.length} unique cities → ${OUTPUT_FILE}`);

  // Stats
  const districts = new Map<string, number>();
  for (const c of cities) {
    districts.set(c.district, (districts.get(c.district) || 0) + 1);
  }
  console.log('\nBy district:');
  for (const [d, count] of [...districts.entries()].sort((a, b) => b[1] - a[1])) {
    if (d) console.log(`  ${d}: ${count}`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
