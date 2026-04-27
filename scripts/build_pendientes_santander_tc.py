#!/usr/bin/env python3
"""
Genera filas para Pendientes desde estados de cuenta TC Santander (PDF consolidado).

Salida:
  imports/pendientes_santander_tc_oct2025_mar2026.csv
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / ".vendor"
if VENDOR.is_dir():
    sys.path.insert(0, str(VENDOR))

try:
    from pypdf import PdfReader  # noqa: E402
except ImportError as e:  # pragma: no cover
    raise SystemExit("Instala dependencias: pip install --target=.vendor pypdf") from e

DEFAULT_PDF = Path.home() / "Downloads" / "Estados_Cuenta_TC_Consolidados_80-14371_a_80-15617.pdf"


@dataclass
class RowOut:
    id: str
    fecha: str
    comercio: str
    monto: float
    tarjeta: str
    banco: str
    email_id: str
    procesado: str = "NO"


def stable_id(parts: list[str]) -> str:
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"bf-san-tc-{h}"


def clp_to_float(token: str) -> float:
    t = token.strip().replace(".", "").replace(",", ".")
    return float(t)


def to_iso_date(dmy: str) -> str:
    d, m, y = dmy.split("/")
    return f"{y}-{m}-{d}"


def should_ignore_line(line: str) -> bool:
    prefixes = (
        "1 DE ",
        "2 DE ",
        "3 DE ",
        "4 DE ",
        "5 DE ",
        "LUGAR DE FECHA DE",
        "OPERACIÓN OPERACION",
        "OPERACIÓN  CUOTA",
        "O COBRO",
        "1. TOTAL OPERACIONES",
        "MOVIMIENTOS TARJETA",
        "2. PRODUCTOS O SERVICIOS",
        "4. INFORMACION COMPRAS",
        "III. INFORMACIÓN DE PAGO",
        "-- ",
    )
    if not line:
        return True
    if line.startswith(prefixes):
        return True
    return False


def parse_line(line: str) -> tuple[str, float] | None:
    """
    Devuelve (comercio, monto) si detecta una línea de movimiento.
    Soporta:
      - "SANTIAGO 23/09/2025 NIU SUSHI ... $ 46.200"
      - "30/09/2025 MONTO CANCELADO $ -807.934"
      - líneas con moneda intermedia (US/PE/CL) y monto final en CLP.
    """
    if should_ignore_line(line):
        return None

    dm = re.search(r"(\d{2}/\d{2}/\d{4})", line)
    if not dm:
        return None
    fecha = to_iso_date(dm.group(1))
    tail = line[dm.end() :].strip()

    mm = re.search(r"\$\s*(-?\d[\d\.,]*)\s*$", tail)
    if not mm:
        return None
    monto = clp_to_float(mm.group(1))
    desc = tail[: mm.start()].strip()
    if not desc:
        return None

    # Recorta ruido final en cuotas antiguas (ej "11/12").
    desc = re.sub(r"\s+\d{2}/\d{2}\s*$", "", desc).strip()
    pref = "[TC ABONO]" if monto < 0 else "[TC CARGO]"
    comercio = f"{pref} {desc}"
    return (f"{fecha}|{comercio}", monto)


def read_tc_pdf(pdf: Path) -> list[RowOut]:
    reader = PdfReader(str(pdf))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    lines = [ln.strip() for ln in text.splitlines()]

    in_actual = False
    rows: list[RowOut] = []
    seen: set[tuple] = set()

    for line in lines:
        if "2. PERIODO ACTUAL" in line:
            in_actual = True
            continue
        if line.startswith("III. INFORMACIÓN DE PAGO"):
            in_actual = False
            continue
        if not in_actual:
            continue

        parsed = parse_line(line)
        if not parsed:
            continue

        k, monto = parsed
        fecha, comercio = k.split("|", 1)
        # Conservamos abonos/pagos negativos para conciliación.
        dedupe_key = (fecha, comercio, round(monto, 2))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        rid = stable_id([fecha, comercio, str(monto)])
        rows.append(
            RowOut(
                id=rid,
                fecha=fecha,
                comercio=comercio,
                monto=abs(monto),
                tarjeta="TC Santander 5815",
                banco="Santander",
                email_id="",
            )
        )

    rows.sort(key=lambda r: (r.fecha, r.id))
    return rows


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf.is_file():
        raise SystemExit(f"No existe PDF TC: {pdf}")

    rows = read_tc_pdf(pdf)
    out_dir = ROOT / "imports"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "pendientes_santander_tc_oct2025_mar2026.csv"

    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["ID", "Fecha", "Comercio", "Monto", "Tarjeta", "Banco", "Email_ID", "Procesado"])
        for r in rows:
            w.writerow([r.id, r.fecha, r.comercio, r.monto, r.tarjeta, r.banco, r.email_id, r.procesado])

    print(f"OK {len(rows)} filas -> {out_path}")


if __name__ == "__main__":
    main()

