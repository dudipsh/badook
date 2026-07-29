#!/usr/bin/env python3
"""
Import RefProduct catalog items from Excel files into labeling-api.

Source files (in repo `temp/`):
  - מקטים יהודה.xlsx       (44 rows,  start row 4)
  - פריטים (1).xlsx         (370 rows, start row 2)

Both share the same column layout:
  קוד פריט | שם פריט | יחידת מידה | מס. קב. פריטים | שם קב. פריטים | כרטיס קניה

Mapping → RefProduct:
  name     ← שם פריט
  category ← שם קב. פריטים  (fallback "לא מסווג" if missing)
  unit     ← יחידת מידה      (fallback "יחידה" if missing)
  avgPrice ← 0  (not present in source data; admin can edit later)

Usage:
  TARGET=local   python3 scripts/import-products-from-xlsx.py
  TARGET=prod    python3 scripts/import-products-from-xlsx.py
"""
import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

import openpyxl

# ─── Config ───────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[3]
TEMP_DIR = REPO_ROOT / "temp"

TARGET = os.getenv("TARGET", "prod").lower()

if TARGET == "prod":
    BASE_URL = os.getenv("LABELING_API_URL", "")
    API_KEY = os.getenv("LABELING_API_KEY", "")
    if not BASE_URL or not API_KEY:
        print("ERROR: TARGET=prod requires LABELING_API_URL and LABELING_API_KEY", file=sys.stderr)
        sys.exit(1)
elif TARGET == "local":
    BASE_URL = os.getenv("LABELING_API_URL", "http://localhost:3002")
    API_KEY = os.getenv("LABELING_API_KEY", "dev-key")
else:
    print(f"ERROR: unknown TARGET={TARGET} (use prod|local)", file=sys.stderr)
    sys.exit(1)

# ─── Excel parsing ────────────────────────────────────────────

CATALOG_FILES = [
    {"path": TEMP_DIR / "מקטים יהודה.xlsx", "header_row": 3},
    {"path": TEMP_DIR / "פריטים (1).xlsx", "header_row": 1},
]

EXPECTED_HEADERS = ["קוד פריט", "שם פריט", "יחידת מידה", "מס. קב. פריטים", "שם קב. פריטים", "כרטיס קניה"]


def parse_catalog_file(path: Path, header_row: int) -> list[dict]:
    """Return list of {name, category, unit} from one xlsx."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    headers = [str(c).strip() if c else "" for c in rows[header_row - 1]]
    # Locate column indexes by header name (allow column-order variation)
    def col_idx(label: str) -> int:
        for i, h in enumerate(headers):
            if h == label:
                return i
        raise ValueError(f"Header {label!r} not found in {path.name}. Headers: {headers}")

    name_i = col_idx("שם פריט")
    cat_i = col_idx("שם קב. פריטים")
    unit_i = col_idx("יחידת מידה")

    items: list[dict] = []
    for row in rows[header_row:]:
        if not row or row[name_i] is None:
            continue
        name = str(row[name_i]).strip()
        if not name:
            continue
        category = str(row[cat_i]).strip() if row[cat_i] else "לא מסווג"
        unit = str(row[unit_i]).strip() if row[unit_i] else "יחידה"
        items.append({"name": name, "category": category, "unit": unit, "avgPrice": 0})
    return items


def post_seed(items: list[dict]) -> dict:
    """POST items to labeling-api seed endpoint (handles upsert server-side)."""
    url = f"{BASE_URL}/ref-data/seed/products"
    body = json.dumps(items).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTPError {e.code}: {e.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        raise


def main() -> int:
    print(f"Target: {TARGET} ({BASE_URL})\n")

    all_items: list[dict] = []
    seen_keys: set[tuple[str, str]] = set()
    duplicates = 0

    for spec in CATALOG_FILES:
        path = spec["path"]
        if not path.exists():
            print(f"  SKIP  {path.name} (missing)")
            continue
        items = parse_catalog_file(path, spec["header_row"])
        added = 0
        for it in items:
            key = (it["name"], it["category"])
            if key in seen_keys:
                duplicates += 1
                continue
            seen_keys.add(key)
            all_items.append(it)
            added += 1
        print(f"  {path.name}: {len(items)} rows → {added} unique (dropped {len(items) - added} dupes within file)")

    print(f"\n  Cross-file duplicates dropped: {duplicates}")
    print(f"  Total to upload: {len(all_items)}\n")

    if not all_items:
        print("Nothing to upload.")
        return 0

    # Show category distribution
    by_cat: dict[str, int] = {}
    for it in all_items:
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
    print("  By category:")
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"    {n:4d}  {cat}")
    print()

    # Upload in chunks to keep request size reasonable
    CHUNK = 200
    total_created = 0
    total_skipped = 0
    for i in range(0, len(all_items), CHUNK):
        chunk = all_items[i:i + CHUNK]
        result = post_seed(chunk)
        c = result.get("created", 0) if isinstance(result, dict) else 0
        s = result.get("skipped", 0) if isinstance(result, dict) else 0
        total_created += c
        total_skipped += s
        print(f"  chunk {i//CHUNK + 1}: created={c} skipped={s}")

    print(f"\nDone. Created/upserted: {total_created}  Skipped: {total_skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
