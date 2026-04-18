# 💰 Finanzas JT — Instrucciones de despliegue

## Archivos incluidos
- `index.html` → La app web completa
- `google-apps-script.js` → Automatización Gmail + emails

---

## PASO 1 — Subir a Netlify (5 minutos)

1. Ve a **netlify.com** e inicia sesión (o crea cuenta gratis)
2. En el dashboard, arrastra la carpeta `finanzas-jt` completa al área de drop
3. Netlify te da una URL como `https://amazing-name-123.netlify.app`
4. (Opcional) En Site settings → Change site name → ponle `finanzas-jt`
5. Tu URL final: `https://finanzas-jt.netlify.app`

---

## PASO 2 — Configurar Google Sheets en la app

1. Abre tu app en el navegador
2. Ve a **Configuración**
3. Ingresa:
   - **ID de la hoja**: `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g`
   - **API Key**: (la que obtengas de Google Cloud)
4. Guarda

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

- La app guarda datos en `localStorage` del navegador ADEMÁS de Google Sheets
- Google Sheets es el respaldo permanente y multi-dispositivo
- Los parsers bancarios activos:
  - ✅ Banco de Chile: emails de `enviodigital@bancochile.cl`
  - ✅ Santander: transferencias de `mensajeria@santander.cl`
  - ⏳ Santander TC: activar cuando llegue primer email de compra
