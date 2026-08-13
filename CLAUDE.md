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
- Toda decision tecnica material se detecta como Candidate Decision / Context Delta para su canonicalizacion posterior en Obsidian Second Brain. Si genera acciones ejecutables, esas acciones se registran en Notion. No duplicar la decision completa en Notion.
- Antes de dar por buena una carga masiva de movimientos bancarios (backfill, reconciliacion), verificar que la suma de lo importado coincida con el total que el propio documento declara (ej. "Monto Total Facturado" del Estado de Cuenta) — evidencia objetiva de que no faltan ni sobran movimientos, no solo confianza.
- Problemas de captura se clasifican antes de actuar: falta de datos (scanner no encontro/proceso algo) se corrige re-corriendo, sin riesgo. Datos incorrectos (se escribio algo mal) se corrige borrando esas filas puntuales. Nunca un vaciado masivo salvo que el usuario lo pida explicitamente.

## Second Brain Protocol

### Canonical sources
- Obsidian Second Brain = contexto durable, decisiones, arquitectura, estado recuperable y Knowledge.
- Notion = Tasks, backlog, responsables y estado de acciones.
- Git = codigo e historial tecnico.
- El Handoff de Notion y `handoff-finanzas-jt-claude-code.md` pueden seguir utilizandose durante el MVP como contexto operacional/tecnico derivado, pero no deben convertirse en una fuente paralela de verdad para decisiones durables.
- Claude Code auto-memory es cache auxiliar local, no memoria canonica.

### Context Delta
Durante una sesion trabaja normalmente. Cuando ocurra un cambio material o al terminar una sesion material, detecta proactivamente un Context Delta sin esperar que Jose lo pida. Clasifica cuando corresponda:
- Project Update
- Candidate Decision
- Candidate Knowledge
- Tasks
- No Persistence

Codigo e implementacion quedan documentados por Git. No dupliques Tasks desde Notion hacia Obsidian. En este MVP Claude Code NO debe escribir directamente al vault de Obsidian. Si existe un Context Delta material, presentalo al cierre para que posteriormente Cowork procese el write-back.

No generes Context Delta por conversaciones triviales ni por cada commit.

### Recovery Test
Antes de finalizar una sesion material aplica el Recovery Test:
"Si este chat desaparece, ¿puede otro agente continuar sin reconstruir decisiones o estado material?"

## Este archivo no se modifica durante sesiones
El contexto vivo del proyecto vive en Notion, no aqui.
