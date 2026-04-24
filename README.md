# 💰 Finanzas JT — Instrucciones de despliegue

## Archivos incluidos
- `index.html` → La app web completa
- `google-apps-script.js` → Automatización Gmail + emails
- `netlify.toml` + `netlify/functions/sheets.js` → Proxy seguro hacia Google Sheets (API key solo en Netlify)

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
2. Abre **`.env`** con un editor y reemplaza el valor de `GOOGLE_SHEETS_API_KEY` por tu clave real (una sola línea, sin comillas).
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

## PASO 3 — Instalar Google Apps Script

1. Abre tu Google Sheet
2. Menú: **Extensiones → Apps Script**
3. Borra el contenido del editor y pega TODO el contenido de `google-apps-script.js`
4. Edita la línea `APP_URL` con tu URL de Netlify
5. Menú: **Ejecutar → inicializar** (primera vez, crea las pestañas)
6. Autoriza los permisos cuando te lo pida

### Configurar activadores automáticos:
1. Menú izquierdo: **Activadores** (ícono de reloj)
2. Agregar activador 1:
   - Función: `scanearGmail`
   - Fuente: Basado en tiempo
   - Tipo: Cada hora
3. Agregar activador 2:
   - Función: `enviarResumenDiario`
   - Fuente: Basado en tiempo
   - Tipo: Día (8:00 AM - 9:00 AM)

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

- La app guarda datos en `localStorage` del navegador ADEMÁS de Google Sheets (categorías, etiquetas, presupuestos en caché; **no** la API Key de Google).
- Google Sheets es el respaldo permanente y multi-dispositivo.
- **Presupuestos**: pestaña `Presupuestos` con columnas `Categoria` y `Monto_Mensual`. Si el libro ya existía, ejecuta de nuevo `inicializar` en Apps Script o crea la pestaña manualmente con esos encabezados.
- Los parsers bancarios activos:
  - ✅ Banco de Chile: emails de `enviodigital@bancochile.cl`
  - ✅ Santander: transferencias de `mensajeria@santander.cl`
  - ⏳ Santander TC: activar cuando llegue primer email de compra
