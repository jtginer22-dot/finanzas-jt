# Roadmap — Finanzas JT

Prioridad establecida el 22-sep-2026. Se actualiza con cada sesión relevante.

## Ahora (en curso)
1. **José: categorizar julio y agosto** en Pendientes — establece la línea base de gasto real de un mes normal.
2. **José: desplegar el fix de reprocesamiento** — `git push` + pegar `google-apps-script.js` en Apps Script (ver `ARCHITECTURE.md` § Cómo desplegar).
3. **José: cargar Ingresos** (sueldo/finiquito) e **Inversiones/ahorro** — con esto la app ya puede calcular ahorro y runway.

## Después de categorizar jul/ago
4. **Módulo de compromisos futuros** (flujo de caja proyectado, no histórico): viajes, cuotas del auto, arreglos del auto, decisión de vivir solo. Hoy la app solo proyecta cuotas de compras ya hechas — no existe un lugar para registrar un gasto futuro planeado y verlo en el flujo de caja. A diseñar: dónde vive (¿pestaña nueva "Compromisos"?), cómo se ve en el dashboard, cómo se compara contra el ahorro/ingresos disponibles.
5. **Presupuestos por categoría** — pestaña existe, vacía.

## Mantenimiento técnico (sin bloquear lo anterior)
- ~~Deduplicar/limpiar pestaña `_Debug`~~ — hecho 22-sep-2026, tras confirmar `_Procesados` funcionando (23.494 filas de log eliminadas).
- Activar backup diario (`configurarActivadores()` ya incluye el trigger `backupDiarioSheet`, falta que José lo corra — sigue pendiente).
- ~~Reconciliación de Santander TC~~ — hecho 22-sep-2026 (`verificarFacturacionSantanderTC_`), validada exacta contra un estado de cuenta real.
- **Segundo chequeo de reconciliación** (Santander TC): comparar la suma de transacciones que SÍ parseamos contra "1. TOTAL OPERACIONES" declarado — eso sí habría detectado el bug de S Y V Ortodoncia (el chequeo actual valida que los subtotales del banco cuadren entre sí, no que capturamos cada línea). Requiere delimitar con precisión qué transacciones caen en cada sección del texto extraído.
- `sheets.js` — `batchPut` exige `range`/`values` de tope aunque no los use (bajo impacto, ver `GUARDRAILS.md`).

## Investigar (no bloqueante)
- Por qué Santander no envió la Cartola Cuenta Vista de agosto (confirmado ausente del correo al 22-sep-2026) — puede ser un retraso normal del banco, monitorear.

## Descartado / resuelto sin acción
- ~~Construir scanner para "Cartola Línea de Crédito Mensual" y "Cartola de Liquidación de Intereses" (Banco de Chile)~~ — confirmado redundante: esos cargos ya se capturan vía Cartola Cuenta Corriente / Estado de Cuenta TC. Ver `SOURCES.md`.

## Roadmap de producto (visión de largo plazo, no priorizado hoy)
- Agente/análisis de inversiones y comportamiento financiero — posponer a módulo aparte cuando el flujo de caja sea estable.
- Evaluar "solo personal" vs. "SaaS con suscripción" antes de integrar APIs bancarias directas.
