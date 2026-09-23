# Fuentes bancarias — Finanzas JT

Estado al 22-sep-2026: **5 fuentes automatizadas**, todas con reconciliación validada contra el propio banco (ver fórmulas abajo). Cada ficha lista el formato del PDF, la función parser, las exclusiones necesarias y casos raros ya encontrados.

## 1. Santander — Estado de Cuenta TC
- **Remitente**: `mensajeria@santander.cl` / `notificaciones@santander.cl`, asunto "estado de cuenta".
- **Parser**: `parsearTransaccionesEstadoCuentaTC_` (texto lineal, fecha `DD/MM/AAAA` completa en el texto — sin ambigüedad de año).
- **Monto capturado**: total de la compra (no la cuota mensual) — la app arma las cuotas al confirmar.
- **Reconciliación**: no construida todavía (pendiente, ver ROADMAP).
- **Caso raro confirmado (22-sep-2026)**: una transacción justo después de un salto de página puede perder su línea de fecha entera — Santander repite los títulos de columna al inicio de cada página, y si el PDF no deja 3+ espacios entre el último título y la fecha, `extract-pdf` no separa esa línea en dos (ej. `"MENSUAL O COBRO 22/06/2026"` en vez de `"22/06/2026"` sola). El parser ahora busca la fecha al final de la línea, no exige que sea toda la línea — ver `GUARDRAILS.md`.

## 2. Santander — Cartola Cuenta Vista
- **Adjunto**: sufijo `_CM.pdf`.
- **Parser**: `parsearCartolaSantanderPorColumnas_` con `COLUMNAS_CUENTA_VISTA` (por coordenadas x,y — el texto lineal no distingue cargo/abono).
- **Solo captura CARGOS** (salidas de dinero); excluye traspasos entre cuentas propias (`trasladoInterno`).
- **Reconciliación** (`verificarCartolaSantanderContraSaldo_`): `Saldo Inicial − Cheques o Cargos + Depósitos o Abonos = Saldo Final`. Validado exacto contra cartola real.
- **Caso raro confirmado**: el bloque de etiquetas de saldo puede quedar separado de sus valores por un párrafo entero de aviso legal en el texto extraído — la extracción busca ventanas de 4 tokens numéricos consecutivos y valida cuál es la correcta comprobando que cuadre la identidad contable (auto-verificante, no asume adyacencia).
- **Gap conocido (22-sep-2026)**: el estado de agosto todavía no ha llegado al correo (confirmado revisando el buzón directamente). No es un bug de captura.

## 3. Santander — Cartola Cuenta Corriente
- **Adjunto**: sufijo `_CC.pdf`. **Ojo**: José tiene más de una cuenta corriente Santander (distintos números de cuenta en el nombre del archivo) — el parser no distingue entre ellas, todas caen en `Santander Cuenta Corriente`.
- **Parser**: `parsearCartolaSantanderPorColumnas_` con `COLUMNAS_CUENTA_CORRIENTE`.
- **Reconciliación**: `SALDO INICIAL + DEPOSITOS + OTROS ABONOS − CHEQUES − OTROS CARGOS − IMPUESTOS = SALDO FINAL` (7 valores, ese orden). Validado exacto, incluida una cartola vacía "SIN MOVIMIENTOS" (formato `0,00` con coma decimal).

## 4. Banco de Chile — Estado de Cuenta TC
- **Remitente**: `enviodigital@bancochile.cl`, asunto "Estado de Cuenta Tarjeta de Crédito".
- **Parser**: `parsearTransaccionesEstadoCuentaTCBancoChile_` (texto lineal).
- **Reconciliación** (`verificarFacturacionBancoChileTC_`, por coordenadas x,y): `SALDO ADEUDADO FINAL PERÍODO ANTERIOR + Σ(VALOR CUOTA MENSUAL de cargos del período actual) = MONTO TOTAL FACTURADO A PAGAR`. Validado exacto en 5 meses reales.
- **Exclusiones necesarias (confirmadas con datos reales, no supuestos)**:
  - Valores **negativos** en la columna de cuota = pagos/abonos ya recibidos ("MONTO CANCELADO", "Pago Pesos TEF", "Pago PAP Cuenta Corriente") — ya están reflejados en el saldo anterior, no son cargo nuevo.
  - Cuota **"00/NN"** = compra recién registrada este período cuyo primer cobro real es el PRÓXIMO período — no facturar todavía.
  - "PAP CENTINELA TARJ CREDITO" / "CARGO POR PAGO TC" = pago automático de la propia TC desde la cuenta corriente — ya contado por este mismo scanner, no duplicar si también aparece en Cartola Cuenta Corriente.
- **Caso raro**: el PDF repite un historial de comprobantes de meses anteriores dentro del mismo texto — un regex simple por etiqueta puede agarrar el campo equivocado (ver `GUARDRAILS.md`).

## 5. Banco de Chile — Cartola Cuenta Corriente
- **Remitente**: `enviodigital@bancochile.cl`, asunto "Cartola Cuenta Corriente". Plantilla soportada: `CartolaCuentaCorrienteNacionalMensual.pdf`. **No soportada**: variante `...NacionalDiaria.pdf` (calibrada solo contra la mensual).
- **Parser**: `parsearCartolaBancoChilePorColumnas_` (`COLUMNAS_CUENTA_CORRIENTE_BANCOCHILE`, por coordenadas x,y).
- **Reconciliación** (`verificarCartolaBancoChileContraSaldo_`): `saldo inicial + abonos − cargos = saldo final`. Validado exacto en 5 meses reales.
- **Exclusión**: "PAP CENTINELA TARJ CREDITO" / "CARGO POR PAGO TC" (mismo motivo que en TC, ver arriba).
- Los cargos de línea de crédito adjunta a la cuenta ("INTERESES LINEA DE CREDITO", "AMORTIZACION A LINEA DE CREDITO", "IMPUESTO LINEA DE CREDITO") **ya se capturan aquí** — dos correos separados de Banco de Chile ("Cartola Línea de Crédito Mensual" y "Cartola de Liquidación de Intereses") son reportes de detalle sobre este mismo cupo/interés y no representan un movimiento adicional; confirmado por inspección de los cargos ya capturados. No requieren scanner propio.

## Documentos de Banco de Chile sin scanner (a propósito)
- **Cartola Línea de Crédito Mensual** — detalle del cupo/línea de crédito; sus cargos reales ya están en la Cartola Cuenta Corriente (ver arriba).
- **Cartola de Liquidación de Intereses** — detalle del cálculo de intereses; el cargo real ya está en el Estado de Cuenta TC o en la Cartola Cuenta Corriente según corresponda.

Si en algún momento se sospecha que falta un movimiento de línea de crédito, verificar primero en Pendientes filtrando por "LINEA DE CREDITO" antes de asumir que hace falta un scanner nuevo.
