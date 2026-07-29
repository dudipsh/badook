#!/usr/bin/env python3
"""
Extract line items from "מעקב פריטים" Excel files and emit a JSON file
grouped by PO number, ready for the TS importer.

Output schema (per PO):
  {
    "poNumber":       "PO25000002",
    "supplierName":   "מרכז הגבס לדוגמה בע\"מ",
    "projectName":    "פרויקט לדוגמה",
    "orderDate":      "2025-01-01",
    "lineItems": [
      { "productCode": "...", "description": "...", "quantity": 38.88, "unitPrice": 23.75, "totalPrice": 923.4 },
      ...
    ],
    "subtotal": ...,
    "vatAmount": ...,
    "totalAmount": ...
  }

Usage:
  python3 scripts/extract-line-items-from-xlsx.py > scripts/line-items.json
"""
import json
import os
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl

REPO_ROOT = Path(__file__).resolve().parents[3]
TEMP_DIR = REPO_ROOT / "temp"

# Point at your own tracking spreadsheets, e.g.
#   ITEM_TRACKING_XLSX="temp/a.xlsx,temp/b.xlsx" python3 scripts/extract-line-items-from-xlsx.py
_sources = os.getenv("ITEM_TRACKING_XLSX", "")
SOURCE_FILES = [Path(p.strip()) for p in _sources.split(",") if p.strip()]
if not SOURCE_FILES:
    SOURCE_FILES = sorted(TEMP_DIR.glob("*.xlsx"))

VAT_RATE = 0.18  # Israeli VAT


def iso_date(d):
    if isinstance(d, datetime):
        return d.date().isoformat()
    if isinstance(d, date):
        return d.isoformat()
    if isinstance(d, str):
        return d
    return None


def parse_file(path: Path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(c).strip() if c else "" for c in rows[0]]

    def col(name: str) -> int:
        for i, h in enumerate(headers):
            if h == name:
                return i
        raise ValueError(f"Header {name!r} not found in {path.name}: {headers}")

    idx = {
        "project":  col("תאור פרויקט"),
        "date":     col("תאריך ההזמנה"),
        "supplier": col("שם ספק"),
        "po":       col("הזמנת רכש"),
        "notes":    col("פרטים"),
        "sku":      col("מק'ט"),
        "desc":     col("תאור מוצר"),
        "qty":      col("כמות"),
        "unitPrice": col("מחיר ליחידה"),
        "total":    col("סכום בשקלים"),
        "status":   col("סטטוס הזמנה"),
    }

    out = []
    for row in rows[1:]:
        if not row or row[idx["po"]] is None:
            continue
        out.append({
            "project":  str(row[idx["project"]]) if row[idx["project"]] else "",
            "date":     iso_date(row[idx["date"]]),
            "supplier": str(row[idx["supplier"]]).strip() if row[idx["supplier"]] else "",
            "po":       str(row[idx["po"]]).strip(),
            "notes":    str(row[idx["notes"]]).strip() if row[idx["notes"]] else "",
            "sku":      str(row[idx["sku"]]).strip() if row[idx["sku"]] else "",
            "desc":     str(row[idx["desc"]]).strip() if row[idx["desc"]] else "",
            "qty":      float(row[idx["qty"]]) if row[idx["qty"]] is not None else None,
            "unitPrice": float(row[idx["unitPrice"]]) if row[idx["unitPrice"]] is not None else None,
            "total":    float(row[idx["total"]]) if row[idx["total"]] is not None else None,
            "status":   str(row[idx["status"]]).strip() if row[idx["status"]] else "",
        })
    return out


def main() -> int:
    all_rows = []
    for p in SOURCE_FILES:
        if not p.exists():
            print(f"SKIP missing: {p.name}", file=sys.stderr)
            continue
        rows = parse_file(p)
        print(f"  {p.name}: {len(rows)} rows", file=sys.stderr)
        all_rows.extend(rows)

    by_po: dict = {}
    for r in all_rows:
        po = r["po"]
        if po not in by_po:
            by_po[po] = {
                "poNumber":     po,
                "supplierName": r["supplier"],
                "projectName":  r["project"],
                "orderDate":    r["date"],
                "lineItems":    [],
            }
        by_po[po]["lineItems"].append({
            "productCode": r["sku"] or None,
            "description": r["desc"],
            "quantity":    r["qty"],
            "unit":        None,
            "unitPrice":   r["unitPrice"],
            "totalPrice":  r["total"],
        })

    docs = []
    for po, doc in by_po.items():
        subtotal = sum((it["totalPrice"] or 0) for it in doc["lineItems"])
        vat = round(subtotal * VAT_RATE, 2)
        total = round(subtotal + vat, 2)
        doc["subtotal"]    = round(subtotal, 2)
        doc["vatAmount"]   = vat
        doc["totalAmount"] = total
        docs.append(doc)

    docs.sort(key=lambda d: d["poNumber"])
    print(f"  Grouped → {len(docs)} POs", file=sys.stderr)
    json.dump(docs, sys.stdout, ensure_ascii=False, indent=2)
    print(file=sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
