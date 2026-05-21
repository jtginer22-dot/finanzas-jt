#!/usr/bin/env python3
"""
Repara columna Monto (D) en Pendientes cuando el comercio trae montos embebidos
(líneas [TC CARGO] ... $ 46.200) y D tiene un cupo/deuda repetido.

Uso:
  python3 scripts/repair_pendientes_montos_from_comercio.py \\
    --site https://finanzas-jt.netlify.app \\
    --spreadsheet-id <ID> \\
    --passcode <APP_PASSCODE> \\
    --suspicious-monto 16873945
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request


def clp_from_token(token: str) -> int:
    t = token.strip().replace(".", "").replace(",", ".")
    return int(round(float(t)))


def monto_from_comercio(text: str) -> int | None:
    amounts = []
    for m in re.finditer(r"\$\s*([\d]{1,3}(?:\.\d{3})+)", text):
        amounts.append(clp_from_token(m.group(1)))
    if not amounts:
        return None
    amounts.sort()
    while len(amounts) > 1:
        mx, med = amounts[-1], amounts[len(amounts) // 2]
        if mx > max(med * 8, 800_000) and mx > 1_000_000:
            amounts.pop()
        else:
            break
    return amounts[0]


def sheets_get(site: str, sheet_id: str, range_: str, passcode: str) -> dict:
    q = urllib.parse.urlencode({"spreadsheetId": sheet_id, "range": range_})
    url = f"{site.rstrip('/')}/.netlify/functions/sheets?{q}"
    req = urllib.request.Request(url, headers={"x-app-passcode": passcode})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def sheets_put_row(site: str, sheet_id: str, row_num: int, monto: int, passcode: str) -> None:
    url = f"{site.rstrip('/')}/.netlify/functions/sheets"
    payload = {
        "spreadsheetId": sheet_id,
        "operation": "put",
        "range": f"Pendientes!D{row_num}:D{row_num}",
        "majorDimension": "ROWS",
        "values": [[monto]],
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "x-app-passcode": passcode},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        if r.status >= 300:
            raise SystemExit(r.read().decode())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="https://finanzas-jt.netlify.app")
    ap.add_argument("--spreadsheet-id", required=True)
    ap.add_argument("--passcode", required=True)
    ap.add_argument("--suspicious-monto", type=int, default=0, help="Solo filas con este monto en D (0 = cualquier >=2M)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = sheets_get(args.site, args.spreadsheet_id, "Pendientes!A2:H5000", args.passcode)
    rows = data.get("values") or []
    fixed = 0
    for i, row in enumerate(rows):
        if len(row) < 8:
            continue
        if str(row[7] or "").strip().upper() not in ("NO", ""):
            continue
        try:
            actual = int(round(float(str(row[3]).replace(".", "").replace(",", "."))))
        except ValueError:
            continue
        if args.suspicious_monto and actual != args.suspicious_monto:
            continue
        if not args.suspicious_monto and actual < 2_000_000:
            continue
        comercio = str(row[2] or "")
        nuevo = monto_from_comercio(comercio)
        if not nuevo or nuevo >= actual:
            continue
        row_num = i + 2
        print(f"Fila {row_num}: {comercio[:60]}…  {actual} -> {nuevo}")
        if not args.dry_run:
            sheets_put_row(args.site, args.spreadsheet_id, row_num, nuevo, args.passcode)
        fixed += 1
    print(f"{'(dry-run) ' if args.dry_run else ''}Corregidas: {fixed}")


if __name__ == "__main__":
    main()
