# 💰 Finanzas JT — Instrucciones de despliegue

## Archivos incluidos
- `index.html` → La app web completa
- `google-apps-script.js` → Automatización Gmail + emails
- `netlify.toml` + `netlify/functions/sheets.js` → Proxy seguro hacia Google Sheets (API key solo en Netlify)
- `netlify/functions/llm-suggest.js` → contrato base para sugerencias de categorización con LLM (pendiente proveedor)
- `netlify/functions/ingest-mobile.js` → endpoint seguro para capturas desde Shortcut/Scriptable (sin exponer API key)

---

## PASO 1 — Subir a Netlify (5 minutos)

1. Ve a **netlify.com** e inicia sesión (o crea cuenta gratis)
2. En el dashboard, arrastra la carpeta `finanzas-jt` completa al área de drop
3. Netlify te da una URL como `https://amazing-name-123.netlify.app`
4. (Opcional) En Site settings → Change site name → ponle `finanzas-jt`
5. Tu URL final: `https://finanzas-jt.netlify.app`

---

## PASO 2 — Variables de entorno en Netlify (API Key fuera del navegador)

La app **no** guarda la API Key de Google en `localStorage`. Una función serverless (`/.netlify/functions/sheets`) firma las llamadas a Google Sheets usando una variable de entorno.

1. En Netlify: **Site configuration → Environment variables**
2. Agrega:
   - **`GOOGLE_SHEETS_API_KEY`**: tu API key de Google Cloud (solo lectura/escritura Sheets según la restrinja en Google Cloud Console).
   - **`APP_PASSCODE`** (recomendado): código secreto para autorizar uso de la app contra tu proxy (header `x-app-passcode`).
   - **`ANTHROPIC_API_KEY`**: clave API para sugerencias LLM de categorización (Claude).
   - (Opcional) **`ANTHROPIC_MODEL`**: modelo Anthropic con **fecha** (ej. `claude-3-5-haiku-20241022`). Evita IDs tipo `claude-3-5-haiku-latest`: la API suele rechazarlos.
3. (Recomendado) **`SHEETS_ALLOWED_SPREADSHEET_IDS`**: el ID de tu spreadsheet (ej. `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g`). Si está definido, el proxy **solo** acepta ese ID y rechaza otros (reduce abuso si alguien descubre la URL de la función).
4. Vuelve a desplegar el sitio tras cambiar variables.

### Guía detallada en el panel de Netlify (producción)

Sigue estos pasos en el **navegador** (no hace falta terminal):

1. Entra en **https://app.netlify.com** e inicia sesión.
2. En la lista de sitios, **haz clic en tu sitio** (por ejemplo el que apunta a `finanzas-jt.netlify.app`).
3. Arriba verás pestañas como **Deploys**, **Logs**, **Configuration**, etc. Entra en **Configuration** (o “Site configuration”).
4. En el menú **izquierdo** de esa sección, busca **Environment variables** (a veces bajo “Build & deploy” o “General”).
5. Pulsa **Add a variable** → **Add a single variable** (o “Add variable”).
   - **Key** (nombre exacto, respetando mayúsculas): `GOOGLE_SHEETS_API_KEY`
   - **Value**: pega tu API Key de Google Cloud (la misma que antes usabas en la app; no la compartas en público).
   - Scope: deja **All scopes** o “Production + Deploy previews” según prefieras; para empezar, **All** está bien.
6. (Recomendado) Agrega otra variable:
   - **Key**: `SHEETS_ALLOWED_SPREADSHEET_IDS`
   - **Value**: solo el ID de tu hoja, por ejemplo `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g` (sin URL, sin barras).
7. **Guardar** cada variable si el panel lo pide.
8. **Forzar un nuevo deploy** para que el sitio en vivo reciba las variables:
   - Ve a la pestaña **Deploys** del mismo sitio.
   - Pulsa **Trigger deploy** → **Deploy site** (o “Clear cache and deploy site” si existe).
9. Espera a que el deploy termine en verde. Luego abre tu URL (`https://finanzas-jt.netlify.app` o la que te dé Netlify) y prueba **Configuración → Guardar y probar conexión**.

**Si el sitio ya existía pero solo subías `index.html`:** asegúrate de que el deploy incluya **toda la carpeta del proyecto**: `index.html`, `netlify.toml`, carpeta `netlify/functions/sheets.js`, etc. Si conectaste **GitHub**, haz **push** de esos archivos al repo vinculado y Netlify redeployará solo.

### Error 503 en `netlify dev` (tu Mac)

Si en la terminal ves `Response with status 503` al llamar a `/.netlify/functions/sheets`, la función está diciendo que **no encuentra la API key en el entorno local**.

1. En la carpeta `finanzas-jt`, copia el archivo de ejemplo:  
   `cp .env.example .env`  
   (o duplica `.env.example` y renómbralo a `.env` desde el Finder).
2. Abre **`.env`** con un editor y reemplaza:
   - `GOOGLE_SHEETS_API_KEY` por tu clave real
   - `APP_PASSCODE` por tu código de acceso
   - `ANTHROPIC_API_KEY` por tu clave de Anthropic
   (una sola línea por variable, sin comillas).
3. **Detén** `netlify dev` (`Ctrl+C` en la terminal) y vuelve a ejecutar **`npm run dev`**.

### Configurar Google Sheets en la app (solo ID)

1. Abre la app en el navegador
2. Ve a **Configuración**
3. Ingresa **solo el ID de la hoja** (el mismo que en la URL de Google Sheets)
4. Guarda y prueba conexión

### Desarrollo local

En la carpeta del proyecto (no hace falta `npm install -g netlify-cli`; evita errores de permisos en `/usr/local`):

```bash
cd ruta/a/finanzas-jt
npm install
npm run dev
```

Eso instala **Netlify CLI** solo dentro de `node_modules` y levanta la app con `/.netlify/functions/sheets`. La primera `npm install` puede tardar **1–2 minutos**; es normal.

Opcional: archivo `.env` en la misma carpeta con `GOOGLE_SHEETS_API_KEY=tu_clave` para probar Sheets en local (`.env` está en `.gitignore`).

Un servidor solo estático (`python -m http.server`) **no** incluye las funciones de Netlify.

---

## PASO 3 — Google Apps Script (detallado)

Usa **la misma spreadsheet** cuyo ID configuraste en la app (Netlify / Configuración).

1. Abre esa hoja en [sheets.google.com](https://sheets.google.com).
2. Menú **Extensiones → Apps Script**. Si es la primera vez, ponle un nombre al proyecto (ej. `Finanzas JT`).
3. En el editor, abre `Código.gs` (o el archivo por defecto), selecciona todo el texto (`Cmd+A` / `Ctrl+A`) y bórralo.
4. En tu computador, abre el archivo **`google-apps-script.js`** de esta carpeta, cópialo **entero** y pégalo en Apps Script.
5. Edita el objeto **`CONFIG`** arriba del archivo:
   - **`APP_URL`**: tu URL pública de la app, ej. `https://tu-sitio.netlify.app` (sin barra final también funciona en los enlaces del script).
   - **`EMAIL_DESTINO`**: el correo donde quieres recibir avisos (debe ser una cuenta a la que tengas acceso).
6. Pulsa **Guardar** (diskette) en Apps Script.
7. En el desplegable de funciones (arriba), elige **`inicializar`** y pulsa **Ejecutar** (▶).
8. Google pedirá **revisar permisos** → elige la cuenta → “Avanzado” → “Ir a … (no seguro)” si aparece → **Permitir**. Sin esto no puede leer Gmail ni escribir la hoja.
9. Vuelve a la **spreadsheet**: deberían existir (o actualizarse) las pestañas que define el script (`Gastos`, `Pendientes`, `Cuentas_Por_Cobrar`, etc.). Si tu libro **ya tenía** una pestaña `Inversiones` con solo 6 columnas, agrega manualmente las columnas **`Cantidad`** y **`Ticker`** en G1 y H1 para alinear con la app.

### Activadores (automatización)

1. En Apps Script, menú izquierdo: **Activadores** (ícono de reloj) → **Agregar activador**.
2. **Activador 1 — Gmail a la hoja**
   - Función: `scanearGmail`
   - Evento: **Basado en tiempo**
   - Tipo de evento: **De hora en hora** (o el intervalo que prefieras).
3. **Activador 2 — Resumen diario**
   - Función: `enviarResumenDiario`
   - Evento: **Basado en tiempo**
   - Tipo: **Día** → elige un rango horario (ej. 8:00–9:00).
4. Tras el primer deploy de Netlify, prueba **Ejecutar → scanearGmail** una vez a mano y revisa la pestaña `Pendientes` y tu correo.

---

## PASO 4 — Agregar al celular

### iPhone:
1. Abre Safari → tu URL de Netlify
2. Botón compartir → "Agregar a pantalla de inicio"
3. Nombre: "Finanzas JT"
4. Queda como ícono en tu home

### Android:
1. Abre Chrome → tu URL
2. Menú (3 puntos) → "Agregar a pantalla de inicio"

---

## Flujo diario esperado

```
08:00 AM → Recibes email "3 gastos nuevos detectados"
         → Tocas el botón "Categorizar ahora →"
         → Se abre la app en tu celular
         → Categorizas cada gasto con 2 taps
         → 2-3 minutos y listo
```

---

## Notas importantes

- La app usa `localStorage` como caché rápida y **Google Sheets** como fuente compartida entre dispositivos. Tras **Guardar / sincronizar** o recargar con ID de hoja, **Cuentas por cobrar/pagar**, **Ingresos** e **Inversiones** se leen y escriben en sus pestañas (`Cuentas_Por_Cobrar`, `Ingresos`, `Inversiones`) para que celular y PC vean lo mismo.
- **Cotización de inversiones**: botón “Cotizar tickers (Yahoo)” llama a `/.netlify/functions/market-quote` (requiere el mismo `APP_PASSCODE` que el resto). Es referencia de mercado, no asesoría.
- Google Sheets es el respaldo permanente y multi-dispositivo.
- **Presupuestos**: pestaña `Presupuestos` con columnas `Categoria` y `Monto_Mensual`. Si el libro ya existía, ejecuta de nuevo `inicializar` en Apps Script o crea la pestaña manualmente con esos encabezados.
- Los parsers bancarios activos:
  - ✅ Banco de Chile: emails de `enviodigital@bancochile.cl`
  - ✅ Santander: transferencias de `mensajeria@santander.cl`
  - ⏳ Santander TC: activar cuando llegue primer email de compra
