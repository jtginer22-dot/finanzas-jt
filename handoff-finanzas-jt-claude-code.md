# Handoff — Finanzas JT (para iniciar sesión en Claude Code)

## Qué es esto
App de finanzas personales de José Tomás Giner. Visión de largo plazo: módulo base de un "LifeOS" personal con agentes de IA.

## Stack y ubicaciones
- **Repo**: `github.com/jtginer22-dot/finanzas-jt` (rama `main`)
- **Deploy**: Netlify, auto-deploy desde `main` → https://finanzas-jt.netlify.app
- **Base de datos**: Google Sheet `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g`
- **Apps Script ID**: `1Np_nDle_70vekCom4Izp9OPM_JdbrQGT0Nw6sv4YKaarPMBOPHz3fMaT`
- **Bancos**: Banco de Chile y Santander.
- **Archivos clave**: `netlify/functions/sheets.js`, `netlify/functions/ingest-mobile.js`, `netlify/functions/lib/google-sheets-token.js`, `index.html`, `google-apps-script.js`, `scripts/import_pendientes_csv_to_sheet.py`
- **Notion (fuente de verdad de contexto vivo)**:
  - Handoff técnico: `notion.so/34fb24851d67813eabd3f8f64960d957`
  - Backlog de desarrollo: `notion.so/35ab24851d67819fa387f59082d7bd68`
  - Estado operativo: `notion.so/35ab24851d67816893d4c39c466cef1f`
- `CLAUDE.md` y `.cursorrules` ya están en el repo con reglas de comportamiento permanentes (deploy, protocolo). Notion mantiene el contexto vivo/temporal — actualizar ahí, no en esos archivos. Este handoff local se mantiene sincronizado con Notion como copia de trabajo.

## Sesión 2026-08-02 — Realineación + nueva estrategia (la vigente)

**Brecha de documentación que se cerró hoy**: Notion y este mismo doc estaban congelados en la sesión del 6 jun 2026, pero el repo siguió hasta el **21 jun 2026** con 5 commits no documentados (parser Santander Estado de Cuenta TC multi-transacción, desencriptado automático de PDF vía `extract-pdf`, `reconciliarHistorico()`, anti-duplicados en cartola, fix timeout de `configurarActivadores()`). Además había cambios sin commitear en el working tree (limpieza de Pendientes, operación `batchPut` en `sheets.js`, lectura ampliada de Pendientes a 5000 filas) a medio camino.

**Causa del desorden en Pendientes**: `reconciliarHistorico()` importó notificaciones de cupo/deuda (montos grandes repetidos) como si fueran transacciones reales. Nada de eso está categorizado/confirmado todavía — no hay riesgo de pérdida de trabajo al reprocesar.

**Decisión de estrategia (José, 2 ago 2026)**: dejar de perseguir "todo automático y robusto" (nunca se llegó a usar). Prioridad ahora: algo simple y usable ya, que se mejora con el tiempo.
- Alcance inicial: leer **cartolas/estados de cuenta de meses cerrados** (no captura en tiempo real por ahora) de **Banco de Chile + Santander**.
- Foco temporal: movimientos de **2026 en adelante primero**; el histórico 2025 y anterior (ya importado por `reconciliarHistorico()`) se conserva pero se archiva aparte sin borrar — se retoma cuando José lo decida.
- Destino: sigue siendo **Pendientes**, para revisión/categorización manual (no directo a Gastos).

**Hallazgo técnico — Banco de Chile vs Santander**: Banco de Chile solo tiene parser de **notificación por email por transacción individual** (`enviodigital@bancochile.cl`, ~línea 186 de `google-apps-script.js`) — no existe parser de **cartola/estado de cuenta mensual en PDF** para Banco de Chile (hay que construirlo). Santander sí tiene parser de Estado de Cuenta TC en PDF maduro (`parsearTransaccionesEstadoCuentaTC_`, `scanearEstadoCuentaSantander_`, con desencriptado automático).

**Sin conector Google vía MCP**: se buscó en el registro de conectores un MCP de Google Sheets/Drive/Apps Script — no existe ninguno disponible. Alternativa: Claude Code opera directamente contra el proxy ya desplegado `netlify/functions/sheets.js` (cuenta de servicio + header `x-app-passcode`) para leer/escribir el Sheet sin login de Google. Para los PDFs de cartola, Claude Code los lee directamente (soporta PDF nativamente) en vez de depender de Apps Script + Gmail en esta primera vuelta.

**Próximo paso exacto**: José entrega los PDF de los meses cerrados (Banco de Chile + Santander) directamente a Claude Code → se decide vaciar/reiniciar Pendientes → se cargan solo movimientos 2026 → José revisa/categoriza en la app.

## Cómo arrancar (vigente)
1. Recibir los PDF de cartola/estado de cuenta de meses cerrados 2026 (Banco de Chile + Santander).
2. Limpiar Pendientes (vaciar, dado que nada está categorizado aún) y archivar el histórico pre-2026 aparte sin borrarlo.
3. Parsear los PDF directamente (Claude Code) y cargar a Pendientes vía `netlify/functions/sheets.js`.
4. Construir parser de cartola/estado de cuenta PDF para Banco de Chile (no existe hoy).
5. Backup automático del Sheet (P0 real de protección de datos, sigue pendiente — ver Backlog).
