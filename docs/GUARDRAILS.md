# Guardrails — trampas ya encontradas

Registro de bugs y trampas de formato ya descubiertas, para no volver a caer en ellas. Cada entrada: qué pasaba, por qué, cómo se detectó, cómo se evita.

## Rollover de año en cartolas (corregido, sep-2026)
**Síntoma**: transacciones de diciembre apareciendo con el año siguiente (ej. "2026-12-09" siendo en realidad diciembre de 2025).
**Causa**: la corrección de año comparaba el mes de la transacción contra `new Date().getMonth()` (la fecha real de HOY, cuando corre el script) en vez del mes del propio correo. Solo funcionaba si el backfill se corría en enero.
**Fix**: comparar el mes de la transacción contra el mes del EMAIL (`fechaEmail.getMonth()`), no contra hoy. Si el mes de la transacción es posterior al mes del email, es del año anterior.
**Cómo se detectó**: auditoría manual buscando fechas > hoy en Pendientes/Gastos, sin nota de cuota.
**Guardrail permanente**: `auditarIntegridadFechas_` corre automático cada 10 min y alerta por correo si aparece una fecha futura sin justificación de cuota.

## Etiqueta ambigua "Monto Facturado" (Banco de Chile TC)
**Síntoma**: un chequeo de suma-vs-total daba "descuadre" en el 100% de los estados de cuenta probados.
**Causa**: la etiqueta "Monto Facturado" aparece **dos veces** con significados distintos en el mismo PDF: una es "MONTO FACTURADO A PAGAR (PERÍODO ANTERIOR)" (el mes pasado, no el actual) y otra es "TOTAL TARJETA" repetido por página como subtotal de una sola categoría de compra (ej. "en una cuota"). Un regex de texto simple agarraba la primera que encontraba.
**Fix**: usar coordenadas x,y para ubicar la etiqueta exacta "MONTO TOTAL FACTURADO A PAGAR (" dentro de la sección "III. INFORMACIÓN DE PAGO" (aparece una sola vez, con fórmula "A + B + C + ... + G" al lado).
**Guardrail**: nunca asumir que una etiqueta de texto es única en un estado de cuenta bancario sin verificar contra el PDF real con coordenadas. El PDF de Banco de Chile TC además repite un historial de comprobantes de meses anteriores dentro del mismo documento.

## Cuota "00/NN" no está facturada todavía
**Síntoma**: la reconciliación de TC Banco de Chile no cuadraba por exactamente el valor de una cuota.
**Causa**: cuando una compra en cuotas se registra por primera vez, el estado de cuenta la muestra con N° de cuota "00/NN" — es informativa, el primer cobro real es el PRÓXIMO período.
**Fix**: excluir de la suma cualquier línea con cuota "00/...".

## Valores negativos en la columna de cuota = pagos, no cargos
**Causa**: "MONTO CANCELADO", "Pago Pesos TEF", "Pago PAP Cuenta Corriente" aparecen en la misma tabla de transacciones que las compras reales, con valor negativo, porque ya están reflejados en el saldo del período anterior.
**Fix**: excluir cualquier valor negativo de la suma de reconciliación.

## Claves compuestas vs. crudas en deduplicación de correos (corregido, sep-2026)
**Síntoma**: los scanners de PDF reprocesaban los mismos correos cada 10 minutos, cada vez.
**Causa**: la columna `Email_ID` de Pendientes guarda `msgId_uid` (clave compuesta, un uid por transacción), pero el chequeo de "ya procesado" comparaba contra el `msgId` crudo — nunca coincidía.
**Fix**: registro dedicado `_Procesados` que guarda el `msgId` crudo, marcado solo si todos los PDF del correo se leyeron sin error (una falla transitoria se reintenta).
**Guardrail**: cualquier lógica de "ya visto" debe comparar claves del mismo formato exacto — verificar con un ejemplo real antes de asumir que funciona.

## Límite de 6 minutos de Apps Script
**Síntoma**: un backfill que reescanea varias fuentes en una sola función se corta a medio camino sin error visible — algunos meses quedan sin procesar silenciosamente.
**Fix**: funciones de backfill separadas por fuente (`importarCartolaBancoChile2026`, etc.) en vez de una función que hace todo.
**Guardrail**: cualquier función que reescanee >60 días de una fuente con PDF debe poder correr sola, sin competir por el presupuesto de 6 minutos con otras fuentes.

## `sheets.js` — `batchPut` exige `range`/`values` de tope aunque no los use
**Síntoma**: una llamada a `batchPut` (con solo `data[]`) devuelve 400 "Faltan range o values".
**Causa**: la validación de body ocurre antes de mirar qué `operation` se pidió.
**Workaround**: incluir un `range`/`values` dummy (ej. el primer elemento de `data[]`) en el body top-level. No arreglado en el proxy todavía — bajo impacto, no bloquea nada.
