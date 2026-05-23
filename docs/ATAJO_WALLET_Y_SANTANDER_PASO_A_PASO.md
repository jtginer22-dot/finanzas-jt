# Atajos iOS — paso a paso (Wallet + app Santander)

Tu configuración actual solo corre cuando pagas con **Apple Pay / Wallet**.  
Las notificaciones de la **app Santander** (Cursor, muchos comercios, suscripciones) **no pasan por Wallet** → necesitas un **segundo automatismo**.

---

## A) Arreglar el atajo que ya tienes (“Cuando use mi tarjeta…”)

### Qué tienes hoy (según tu captura)

1. Recibir transacción como entrada  
2. Obtener contenido de URL → `ingest-mobile`  
3. Obtener diccionario de la respuesta  
4. Mostrar notificación  

**Problemas típicos:**

- Falta **método POST**, cabeceras y **cuerpo JSON** con `spreadsheetId`.
- Si el cuerpo es la transacción “cruda” sin armar, a veces el servidor leía números extra (cupo) y guardaba millones.

### Pasos detallados (editar el atajo existente)

#### 1. Abrir el atajo

App **Atajos** → atajo **“Cuando use mi tarjeta de…”** → **Editar**.

#### 2. Después de “Recibir transacción como entrada”

Toca **+** y agrega estas acciones **en este orden** (antes de “Obtener contenido de URL”):

**Acción A — Diccionario**

- Busca: `Diccionario`
- Toca **Agregar nuevo elemento** varias veces:

| Clave | Valor (toca y elige variable mágica) |
|-------|--------------------------------------|
| `spreadsheetId` | Texto fijo: `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g` |
| `comercio` | De la transacción: **Comercio** (o Merchant / Nombre del comercio) |
| `monto` | De la transacción: **Importe** (o Amount / Cantidad) — **solo este** |
| `fecha` | **Fecha actual** → formato personalizado `yyyy-MM-dd` |
| `tarjeta` | Texto: `TC Santander` |
| `banco` | Texto: `Santander` |
| `uid` | De la transacción: **Identificador** (si no existe, usa **UUID** o texto aleatorio) |

No agregues clave `total`. No pegues el texto largo de cupo si ya mandas `monto` del importe Wallet.

**Acción B — Obtener contenido de**

- Entrada: el **Diccionario** del paso anterior  
- Formato: **JSON**

#### 3. Configurar “Obtener contenido de URL” (importante)

Toca la acción azul **Obtener contenido de** `https://finanzas-jt.netlify.app/.../ingest-mobile` y revisa **todas** estas opciones:

| Campo | Valor |
|-------|--------|
| **Método** | `POST` |
| **Cabeceras** | Agregar dos filas: |
| | `Content-Type` → `application/json` |
| | `x-app-passcode` → *(el mismo passcode de Configuración en la app web)* |
| **Cuerpo de la solicitud** | **Archivo** |
| **Cuerpo del archivo** | Salida de **Obtener contenido de** (el JSON del diccionario) |

Si “Cuerpo” está en “Ninguno” o “Texto” vacío, el servidor no recibe datos y los montos fallan.

#### 4. Dejar la respuesta como la tienes

- Obtener diccionario de **Contenido de URL**  
- Mostrar notificación (opcional: muestra solo `message` o `ok` si quieres menos ruido)

#### 5. Automatización (no solo el atajo)

**Automatización** → tu regla **“Cuando use mi tarjeta”** → debe ejecutar **este atajo** y tener **Ejecutar sin preguntar** activado.

#### 6. Probar

Paga algo con Wallet o usa **Probar** en el atajo. En la app web → **Pendientes** debe aparecer el comercio con monto correcto (miles, no millones).

---

## B) Nuevo automatismo — notificaciones app Santander

Santander **no te manda correo** → **Apps Script no captura eso**. Esto es obligatorio para Cursor, Disney+, etc. si no usas Wallet.

### Crear automatización

1. App **Atajos** → pestaña **Automatización** → **+** → **Automatización personal**.
2. **Notificación** → Siguiente.
3. **App:** busca **Santander** (icono rojo del banco).
4. **Tipo:** Cualquiera (o “Inmediata” si aparece).
5. Siguiente → **Ejecutar inmediatamente** → Siguiente.

### Acciones dentro de la automatización

**1. Obtener texto**

- Si aparece **Contenido de la notificación** o **Texto proporcionado**, úsalo.
- Si no, **Obtener texto de** → **Entrada de atajo** / **Atajo**.

Guarda mentalmente como “TextoNotif”.

**2. Diccionario**

| Clave | Valor |
|-------|--------|
| `spreadsheetId` | `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g` |
| `texto` | **TextoNotif** (todo el cuerpo de la notificación) |
| `comercio` | Texto fijo `Compra` *(luego editas en la app)* o extrae con “Obtener grupo de expresiones regulares” si quieres |
| `fecha` | Fecha actual `yyyy-MM-dd` |
| `tarjeta` | `TC Santander` |
| `banco` | `Santander` |
| `uid` | UUID |

**No pongas** `monto` a mano: el servidor lo saca de `texto` (compra, no cupo).

**3. Obtener contenido de** → Diccionario → **JSON**

**4. Obtener contenido de URL** — igual que en la sección A (POST, headers, cuerpo archivo JSON).

**5. (Opcional) Mostrar notificación** con la respuesta.

### Activar

Guardar → desactiva **Preguntar antes de ejecutar** → **Listo**.

Haz una compra de prueba o espera la próxima notificación Santander y revisa **Pendientes**.

---

## Apps Script — ¿hace falta?

| Fuente | ¿Lo captura Apps Script? |
|--------|---------------------------|
| Email Banco de Chile | Sí |
| Email Santander | Solo si existiera correo (en tu caso **no**) |
| Notificación app Santander | **No** — solo Atajo B |
| Apple Pay / Wallet | **No** — solo Atajo A |

**Qué archivo usar:** en el repo `finanzas-jt/google-apps-script.js` (copia completa al editor de script ligado a tu Google Sheet).

**Para qué sirve:** escanear **Gmail** cada hora y el resumen diario. **No reemplaza** el Atajo Santander.

**Cómo actualizar:**

1. Abre tu Google Sheet → **Extensiones** → **Apps Script**.
2. Borra el contenido del archivo `.gs` principal.
3. Pega el contenido de `google-apps-script.js` del repo.
4. **Guardar** (icono disco).
5. No hace falta redeploy de Netlify por esto.

---

## Montos malos — qué pasó y qué hacer ahora

| Origen | Síntoma | Qué hacer |
|--------|---------|-----------|
| Atajo + cupo en texto | Muchos ~$16.873.945 iguales | Corregir con **Monto** o atajo arreglado (A + B) |
| Import cartola `[Vista]` / `[CC]` | $5M, $10M, $32M | **Configuración** → Rechazar cartola mal parseada, o **Monto** |
| Wallet bien al inicio | Luego se rompió | Probable cambio de cuerpo del POST o import masivo mezclado |

**Sí:** los datos **ya guardados** en el Sheet hay que corregirlos tú (botón **Monto**) o rechazar los que no sean gastos reales. **A futuro** no deberían repetirse con atajo + servidor actualizados.

**Atajos en Pendientes:** botón **Sospechosos**, orden **Monto ↓**, filtro **TC cargos** para priorizar lo real.
