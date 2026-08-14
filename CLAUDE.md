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

Antes del mensaje final de cierre, ejecutar estos dos pasos obligatorios:

1. Context Delta: si la sesion fue material, generar espontaneamente un bloque breve SESSION DELTA. Incluir unicamente las categorias que realmente correspondan:
   - Project Update
   - Candidate Decision
   - Project Knowledge / Technical Guardrail
   - Candidate Knowledge
   - Tasks
   - No Persistence

   Reglas: no generar Delta para una sesion trivial. No repetir el historial de commits. Codigo e implementacion quedan en Git. Tasks quedan en Notion. Las decisiones/contexto durable se presentan para su posterior canonicalizacion en Obsidian — Claude Code no escribe directamente al vault durante este MVP. No incluir secrets ni datos sensibles innecesarios. No repetir informacion solo para hacer el cierre mas completo.

2. Recovery Test: despues del SESSION DELTA, responder "Si este chat desaparece ahora, ¿puede otro agente continuar sin reconstruir decisiones o estado material?" con PASS, PARTIAL o FAIL. Solo si es PARTIAL o FAIL, listar brevemente los gaps reales y su destino correcto (Git / Obsidian / Notion / Handoff derivado / No Persistence). Algo que todavia no ha ocurrido o no ha sido decidido no cuenta como gap.

El cierre normal debe seguir siendo practico — no repetir la auditoria extensa del primer piloto en cada sesion. Formato esperado (omitir secciones vacias; el detalle solo crece si la sesion realmente lo justifica):

SESSION DELTA

Project Update
- ...

Candidate Decision
- ...

Project Knowledge / Guardrail
- ...

Tasks
- ... [Notion]

RECOVERY TEST: PASS

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
