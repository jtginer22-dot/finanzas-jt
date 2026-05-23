# Atajo iOS → ingest-mobile (Mayo 2026)

Guía espejo de Notion: [Atajo iOS → ingest-mobile (Mayo 2026)](https://www.notion.so/369b24851d6781e6b3d5f73bf8e16d32)

## Problema que resuelve

Las notificaciones de Santander suelen incluir **dos montos**: la compra (ej. $45.990) y el **cupo o deuda total** (ej. $16.873.945).  
Si el atajo mandaba el número más grande, todas las filas en Pendientes quedaban con el mismo monto erróneo.

Desde el deploy `6b70d6c`, el servidor prioriza el monto de **compra** en el texto.

## Endpoint

```
POST https://finanzas-jt.netlify.app/.netlify/functions/ingest-mobile
```

Headers:

- `Content-Type: application/json`
- `x-app-passcode: <tu APP_PASSCODE>`

## Campos JSON recomendados

| Campo | Obligatorio | Notas |
|-------|-------------|--------|
| `spreadsheetId` | Sí | `1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g` |
| `texto` | Muy recomendado | Cuerpo completo de la notificación |
| `comercio` | Recomendado | Nombre del comercio |
| `fecha` | Recomendado | `yyyy-MM-dd` |
| `tarjeta` | Opcional | Ej. `TC Santander` |
| `banco` | Opcional | `Santander` |
| `uid` | Recomendado | Id único por notificación (evita duplicados) |
| `monto` | Opcional | Solo si es el monto **de la compra**; si dudas, omítelo |

**No enviar** `total` con el cupo disponible.

## Pasos en la app Atajos (Shortcuts)

1. **Disparador:** notificación del banco o transacción Wallet.
2. **Obtener texto** de la notificación → variable `TextoNotificacion`.
3. **Diccionario** con las claves de la tabla (usar `texto` = `TextoNotificacion`).
4. **Obtener contenido de** diccionario → **JSON**.
5. **Obtener contenido de URL** → POST al endpoint, headers arriba, cuerpo = JSON.

## Ejemplo

```json
{
  "spreadsheetId": "1Aeiav6ZIiC_o8zgqwM7qRxgFtXB3eHROW9-NtJ4GU5g",
  "texto": "Compra por $45.990 en JUMBO... Cupo disponible $16.873.945",
  "comercio": "JUMBO",
  "fecha": "2026-05-18",
  "tarjeta": "TC Santander",
  "banco": "Santander",
  "uid": "notif-20260518-001"
}
```

Resultado esperado en columna **Monto** del Sheet: `45990`.

## Corregir datos viejos

En la app web: Pendientes → botón **Monto** en cada fila (sincroniza columna D del Sheet).
