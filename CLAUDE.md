# Finanzas JT — Claude Code

## Inicio de sesion obligatorio
Leer Notion antes de cualquier accion:
- Handoff: https://www.notion.so/34fb24851d67813eabd3f8f64960d957
- Backlog: https://www.notion.so/35ab24851d67819fa387f59082d7bd68

Confirmar en 2 lineas: estado actual + tarea prioritaria.

## Cierre de sesion obligatorio
Sin esperar instruccion, actualizar Handoff en Notion con:
- Que se completo
- Archivos modificados y por que
- Decisiones tecnicas tomadas
- Proximo paso exacto

Recordar al usuario: git add -A && git commit -m "..." && git push origin main

## Reglas permanentes
- Hacer push a GitHub (`git push origin main`) después de cada cambio relevante — el deploy en Netlify se dispara automáticamente
- NUNCA hacer deploy manual arrastrando carpeta en Netlify — solo vía git push
- Cambios minimos — no tocar lo que funciona
- Leer el archivo completo antes de modificarlo
- Nunca hardcodear secrets — siempre process.env.*
- Modelo IA: claude-3-5-haiku-20241022 (nunca "latest")
- Toda decision tecnica relevante va a Notion de oficio, sin que el usuario lo pida

## Este archivo no se modifica durante sesiones
El contexto vivo del proyecto vive en Notion, no aqui.
