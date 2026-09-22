# Arquitectura — Finanzas JT

## Vista general del flujo

```
Correo (Gmail de José)
    │  Apps Script: GmailApp.search() cada 10 min (trigger)
    ▼
google-apps-script.js (vive en el editor de Apps Script vinculado al Sheet)
    │  PDF encriptado → netlify/functions/extract-pdf.js (desencripta con RUT, devuelve texto + coordenadas x,y)
    │  parsers por fuente → transacciones {fecha, comercio, monto}
    ▼
Google Sheet — pestaña Pendientes (vía SpreadsheetApp nativo desde Apps Script)
    │  índex.html (app web) lee/escribe el Sheet vía netlify/functions/sheets.js (proxy + cuenta de servicio)
    ▼
José categoriza en la app → pestaña Gastos
```

Claude Code, fuera de este flujo en producción, opera el Sheet directamente contra `netlify/functions/sheets.js` (GET con `GOOGLE_SHEETS_API_KEY`, POST con cuenta de servicio) usando el mismo passcode que la app, para diagnosticar y corregir datos sin pasar por Apps Script.

## Piezas y dónde viven

| Pieza | Archivo/ubicación | Responsabilidad |
|---|---|---|
| Captura automática | `google-apps-script.js` (pegado a mano en el editor de Apps Script del Sheet) | Buscar correos, desencriptar PDF, parsear, escribir a Pendientes, controles de integridad |
| Desencriptado/extracción de PDF | `netlify/functions/extract-pdf.js` | Recibe PDF en base64 + contraseña, devuelve texto lineal y `items` (coordenadas x,y de cada fragmento) |
| Proxy de Sheets | `netlify/functions/sheets.js` | GET con API key; POST (append/put/batchPut/clear) con cuenta de servicio. Único punto de escritura al Sheet fuera de Apps Script |
| App web | `index.html` | Dashboard, categorización de Pendientes, cuotas, presupuestos, etc. |
| Base de datos | Google Sheet `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g` | Única fuente de verdad de los datos |
| Deploy | Netlify, auto-deploy desde `main` → https://finanzas-jt.netlify.app | — |

## Por qué el código de captura vive en dos lugares (Git y Apps Script)

Google Apps Script no lee desde GitHub. `google-apps-script.js` en el repo es la fuente de verdad versionada, pero **no tiene efecto en producción hasta que José lo pega manualmente en el editor de Apps Script y guarda**. Un `git push` no despliega este archivo (a diferencia de Netlify, que sí es automático). Esto es una fuente recurrente de confusión — siempre recordar el paso manual al proponer un cambio en `google-apps-script.js`.

## Pestañas del Google Sheet

| Pestaña | Contenido | Quién escribe |
|---|---|---|
| `Pendientes` | Movimientos capturados, sin categorizar | Apps Script (scanners) |
| `Gastos` | Movimientos categorizados/confirmados | App web (al categorizar) |
| `Ingresos` | Sueldo, finiquito, etc. | App web (manual) — **vacía hoy** |
| `Inversiones` | Instrumentos, valor invertido/actual | App web (manual) — **vacía hoy** |
| `Cuentas_Por_Cobrar` | Préstamos y trámites de terceros | App web |
| `Presupuestos` | Límite mensual por categoría | App web (manual) — **vacía hoy** |
| `Categorias` | Categorías y etiquetas conocidas, sync entre dispositivos | App web |
| `Conciliacion_Mensual` | Comparación cartola vs. app a fin de mes | App web (manual) — **vacía hoy** |
| `_Debug` | Diagnóstico de los scanners (texto crudo, coordenadas, chequeos de reconciliación) | Apps Script — **solo diagnóstico, se puede vaciar sin riesgo** |
| `_Procesados` | Registro de correos con PDF ya leídos completos (evita reprocesar) | Apps Script — nueva desde sep-2026 |
| `_Alertas` | Hallazgos de `auditarIntegridadFechas_` | Apps Script |

## Ejecución y límites de Apps Script

- Apps Script corta cualquier ejecución a los ~6 minutos. Los backfills manuales (`importarCerrados2026`, etc.) que reescanean 220+ días de una fuente pesada pueden alcanzar ese límite — por eso existen funciones de backfill **aisladas por fuente** (ver `importarCartolaBancoChile2026`), en vez de una sola función que lo haga todo.
- El scan rutinario (`scanearGmail`, trigger cada 10 min) usa una ventana corta (35 días por defecto) y, desde el fix de `_Procesados`, salta los correos ya leídos — rápido y barato.
- `configurarActivadores()` crea/reemplaza los triggers: `scanearGmail` (10 min), `enviarResumenDiario` (8 AM), `backupDiarioSheet` (4 AM).

## Cómo desplegar un cambio

1. Editar `google-apps-script.js` y/o `index.html`/`netlify/functions/*` en el repo.
2. `git add -A && git commit -m "..." && git push origin main` — dispara el deploy de Netlify automáticamente (para `index.html` y `netlify/functions/*`).
3. Si se tocó `google-apps-script.js`: pegar el archivo completo en el editor de Apps Script del Sheet y guardar. Sin este paso, el cambio no tiene ningún efecto en producción aunque esté en GitHub.
4. Si el deploy de Netlify no se refleja: revisar en Netlify → Deploys que el build esté "Published", y recargar forzando (Cmd+Shift+R).
