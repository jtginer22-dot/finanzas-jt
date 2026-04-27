#!/usr/bin/env python3
"""
Importa un CSV al rango Pendientes!A:H vía Netlify function `sheets`.

Uso:
  python3 scripts/import_pendientes_csv_to_sheet.py \
    --csv imports/pendientes_santander_todo_oct2025_mar2026.csv \
    --site https://finanzas-jt.netlify.app \
    --spreadsheet-id <SHEET_ID> \
    --passcode <APP_PASSCODE>
"""

from __future__ import annotations

import argparse
import csv
import json
import urllib.request
import urllib.error
from pathlib import Path


def post_json(url: str, payload: dict, passcode: str) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-app-passcode": passcode,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Ruta CSV con columnas Pendientes A:H")
    ap.add_argument("--site", default="https://finanzas-jt.netlify.app", help="URL base Netlify")
    ap.add_argument("--spreadsheet-id", required=True, help="Google Spreadsheet ID")
    ap.add_argument("--passcode", required=True, help="APP_PASSCODE")
    ap.add_argument("--batch-size", type=int, default=200, help="Filas por request")
    args = ap.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.is_file():
        raise SystemExit(f"No existe CSV: {csv_path}")

    rows: list[list[str]] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        required = ["ID", "Fecha", "Comercio", "Monto", "Tarjeta", "Banco", "Email_ID", "Procesado"]
        if not all(c in (r.fieldnames or []) for c in required):
            raise SystemExit(f"CSV inválido, requiere columnas: {required}")
        for row in r:
            rows.append([row[k] for k in required])

    if not rows:
        raise SystemExit("CSV sin filas.")

    url = args.site.rstrip("/") + "/.netlify/functions/sheets"
    sent = 0
    for i in range(0, len(rows), args.batch_size):
        chunk = rows[i : i + args.batch_size]
        payload = {
            "spreadsheetId": args.spreadsheet_id,
            "operation": "append",
            "range": "Pendientes!A:H",
            "appendAnchor": "Pendientes!A1",
            "majorDimension": "ROWS",
            "valueInputOption": "RAW",
            "insertDataOption": "INSERT_ROWS",
            "values": chunk,
        }
        status, body = post_json(url, payload, args.passcode)
        if status < 200 or status >= 300:
            msg = body.strip() or f"HTTP {status}"
            if status == 401 and "Passcode" in body:
                msg = (
                    "HTTP 401 del proxy: passcode incorrecto o faltante.\n"
                    "- Debe coincidir con APP_PASSCODE en Netlify (sin espacios extra)\n"
                    f"- Respuesta: {body}"
                )
            elif status == 401 and "UNAUTHENTICATED" in body:
                msg = (
                    "Google devolvió 401 UNAUTHENTICATED (no es el passcode de la app).\n"
                    "Sheets no acepta API key para append: configura en Netlify\n"
                    "GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,\n"
                    "comparte la hoja con el email de la cuenta de servicio, redeploy, y vuelve a intentar.\n"
                    f"- Respuesta: {body}"
                )
            elif status == 503 and "Escritura a Sheets" in body:
                msg = body
            raise SystemExit(msg)
        sent += len(chunk)
        print(f"OK batch {i // args.batch_size + 1}: +{len(chunk)} (total {sent})")

    print(f"Importación completa: {sent} filas a Pendientes.")


if __name__ == "__main__":
    main()

