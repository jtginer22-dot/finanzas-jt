# Decisiones — Finanzas JT

Registro append-only. Nunca se reescribe una entrada pasada; si una decisión cambia, se agrega una nueva entrada que referencia la anterior. Formato: fecha, decisión, por qué, alternativas descartadas, consecuencias.

---

### 2026-08-02 — Abandonar "todo automático y robusto", priorizar simple y usable
**Decisión**: dejar de perseguir una captura 100% automática en tiempo real. Prioridad: leer cartolas/estados de cuenta de meses cerrados, simple, que se mejora con el tiempo.
**Por qué**: la versión "robusta" nunca se llegó a usar en el día a día.
**Alcance**: movimientos de 2026 en adelante primero; histórico 2025 se conserva archivado, se retoma cuando José lo decida.
**Consecuencia**: Pendientes es el destino de todo lo capturado (revisión manual), nunca directo a Gastos.

### 2026-09-07 (aprox.) — Auditar, no vaciar, ante dudas de integridad de datos
**Decisión**: cuando se detecta un problema de captura, se clasifica antes de actuar — falta de datos (scanner no procesó algo) se corrige re-corriendo, sin riesgo; datos incorrectos (se escribió algo mal) se corrige con una corrección puntual (o borrando esas filas puntuales). Nunca un vaciado masivo salvo pedido explícito del usuario.
**Por qué**: preservar el trabajo de categorización manual ya hecho; un vaciado es irreversible y desproporcionado frente a un bug acotado.
**Ejemplo de aplicación**: el bug de rollover de año (22 fechas mal calculadas) se corrigió con una corrección puntual de esas celdas, no un re-import completo.

### 2026-09-07 (aprox.) — Reconciliar contra la identidad contable del banco, no contra una etiqueta de texto
**Decisión**: todo chequeo de "¿está completo lo que capturamos?" se construye encontrando la fórmula real que el banco declara (saldo inicial + movimientos = saldo final; o saldo anterior + cargos del período = monto facturado), validada con datos reales de varios meses independientes antes de darla por buena — no comparando contra la primera etiqueta de texto que parezca correcta.
**Por qué**: un chequeo mal construido (comparando contra una etiqueta ambigua) generó falsos "descuadre" en el 100% de los casos y casi lleva a desconfiar de una captura que en realidad estaba bien. Ver `GUARDRAILS.md`.
**Consecuencia**: cada fuente nueva de reconciliación requiere: (1) obtener texto/coordenadas reales de al menos 2-3 documentos independientes, (2) derivar la fórmula, (3) validarla exacta antes de conectarla en producción.

### 2026-09-21/22 — Todo se categoriza, incluyendo costos financieros
**Decisión**: intereses de mora, avances en efectivo y pagos grandes que no son consumo directo SÍ se categorizan (ej. "Costo financiero", "Avance en efectivo") — no se excluyen ni se ignoran. El único caso que no es "gasto" es un movimiento que es simplemente traspasar plata entre cuentas propias del usuario (tipo `no_gasto`).
**Por qué**: José necesita entender el comportamiento completo, incluyendo el costo de usar crédito, no solo el consumo.
**Consecuencia**: `no_gasto` se usa con criterio estricto (solo traspasos propios), no como categoría cajón de sastre para "esto no sé qué es".

### 2026-09-22 — Push a GitHub vía token local, aislado de otras cuentas
**Decisión**: para que Claude Code pueda pushear directo a `jtginer22-dot/finanzas-jt` sin depender del llavero interactivo de José (que este entorno no puede usar), se generó un Personal Access Token de esa cuenta con scope `repo`, guardado en `.git/credentials-local` (dentro de `.git/`, nunca versionado) con `credential.helper` configurado **localmente** (`git config --local`), no globalmente.
**Por qué**: José usa Claude Code en paralelo para otro proyecto con otra cuenta de GitHub (autenticada por SSH vía un alias dedicado en `~/.ssh/config`). La solución debía convivir con eso sin interferir al alternar entre sesiones.
**Intento descartado**: reusar la llave SSH ya configurada (`github-jtgl` → cuenta `asesoriasjtgl-sudo`) — tiene acceso de lectura al repo pero no de escritura; no es la cuenta dueña del repo.
**Guardrail encontrado en el camino**: la config global tenía `credential.https://github.com.useHttpPath=true` (probablemente del setup de la otra cuenta), lo que rompía la búsqueda del token guardado por host simple. Se corrigió con un override **local** (`useHttpPath false` solo en este repo), sin tocar la config global.
**Consecuencia**: este repo nunca depende de `~/.ssh/config` ni del credential helper global — su autenticación vive enteramente dentro de su propia carpeta `.git/`.

### 2026-09-22 — Rediseño de "¿Es compartido?" + tercer nivel de granularidad (Notas)
**Decisión**: "Lo invito yo" se elimina (no estaba conectada a ninguna lógica, era un no-op sin que José lo supiera). "Dividir con n personas" y "División custom" se fusionan en un modo único con selector partes-iguales/montos-personalizados, soportando N personas con proporciones distintas (antes custom solo admitía 2 personas). Se agrega un tercer nivel de granularidad, **Notas** (texto libre), junto a Categoría y Etiqueta — ver `CATEGORIZATION.md`.
**Por qué**: José detectó, usando la app en la práctica, que la sección estaba "poco intuitiva" y con opciones sin efecto real; y que varias etiquetas ya creadas ("Regalo Juan Undurraga", etc.) eran en realidad notas de un movimiento puntual, no conceptos reutilizables — la falta de un tercer nivel forzaba a sobrecargar las etiquetas.
**Alternativas descartadas**: mantener "Lo invito yo" construyéndola de verdad (registrar a quién se invitó sin generar cobro) — José prefirió eliminarla por ahora, se puede reconstruir si en algún momento le importa ese reporte específico.

### 2026-09-22 — Arquitectura de contexto: carpeta `docs/` en Git
**Decisión**: crear `docs/CONTEXT.md`, `ARCHITECTURE.md`, `SOURCES.md`, `GUARDRAILS.md`, `DECISIONS.md`, `CATEGORIZATION.md`, `ROADMAP.md` como fuente de contexto y decisiones técnicas del proyecto, versionada junto al código.
**Por qué**: el contexto vivo estaba repartido entre Notion (que se congelaba entre sesiones) y un handoff local desactualizado, sin un lugar único para el "por qué" de las decisiones técnicas.
**Relación con Notion/Obsidian (CLAUDE.md)**: Notion sigue siendo para Tasks/backlog. Las decisiones durables de producto/estrategia personal, cuando Obsidian esté conectado, se canonizan ahí. Mientras esa captura automática no exista, `docs/DECISIONS.md` mantiene el registro técnico y de producto de este proyecto sin depender de ese paso manual.
**Mantenimiento**: cuando una decisión se toma en una sesión, se agrega a este archivo en el mismo commit que el cambio de código asociado (si lo hay).

### 2026-09-22 (misma sesión) — "Lo invito yo" se reincorpora, con función real; nombre de persona consolidado
**Decisión 1 — revierte parcialmente la entrada anterior de este mismo día**: "Lo invito yo" vuelve como modo `invito`. José aclaró que sí le es relevante: casos donde paga 100% él pero estuvo con alguien (ej. invitar a comer a Trini), y quiere poder ver cuánto gasta invitando al mes. Implementación: el gasto queda íntegro como personal (no genera Cuenta por Cobrar), se etiqueta automáticamente `Invité` (reusable, ver `CATEGORIZATION.md`) y se agrega `Invité a <persona>` a Notas. No hay agregación en dashboard todavía — se puede filtrar/sumar manualmente por la etiqueta `Invité` en Historial.
**Decisión 2**: se detectó que el modo "Con polola 50/50" guardaba la persona en Cuentas_Por_Cobrar como el string literal `"Polola"` en vez del nombre real (`Trini`), generando una fila de deuda separada que no se consolidaba con el resto de las deudas de Trini. Se corrigió el código (`fillPendQuienSelect`/`leerPendQuien`/`toggleCompFields` en `index.html`) para que el valor por defecto sea `"Trini"` directamente. Se corrigió además el único registro histórico afectado en el Sheet (`Cuentas_Por_Cobrar!C8`, LATAM.COM XP INTER, $87.201) de `"Polola"` a `"Trini"` vía `sheets.js`.
**Por qué**: José detectó ambos problemas usando la app en la práctica — la etiqueta "Polola" (relación) seguía existiendo como concepto reutilizable en Etiquetas, era el nombre-de-persona-para-cobrar el que estaba mal resuelto.
**Consecuencia**: el nombre real de la persona (Trini) es ahora la única fuente de verdad para deudas; "Polola" solo sobrevive como Etiqueta de contexto, nunca como valor de `persona` en Cuentas_Por_Cobrar/Pagar.

### 2026-09-22 (misma sesión) — Categoría `Otros` para gastos sin certeza; bug de ID duplicado en Categorias
**Hallazgo 1**: la pestaña `Categorias` del Sheet tenía dos filas con el mismo ID `c1`: `"Crédito consumo"` (correcta) y `"Cródito consumo"` (typo). Con el merge por NOMBRE (previo a hoy) ambas convivían como categorías separadas sin que se notara. Con el fix de merge por ID de hoy (ver entrada anterior del 22-sep sobre Comida/Snacks), al colapsar por ID solo sobrevive la última fila procesada — que resultó ser la del typo, dejando "Crédito consumo" (la correcta) invisible. José lo detectó de inmediato al seguir categorizando.
**Fix**: se vació la fila duplicada (`Categorias!A5:E5`, la del typo) directamente en el Sheet vía `sheets.js`; no había ningún Gasto ya categorizado usando el nombre con typo, así que no hubo que migrar datos. `"Crédito consumo"` (id `c1`) es ahora la única fila viva para ese ID.
**Guardrail nuevo**: un ID duplicado en `Categorias` con nombres distintos es un estado inválido de datos — si vuelve a aparecer (ej. por edición manual del Sheet), el merge por ID se queda con el último silenciosamente; conviene revisar `Categorias` de vez en cuando por IDs repetidos.
**Decisión 2**: se confirma "Otros" (categoría preexistente) como destino explícito para gastos cuyo nombre de cobro no permite saber con certeza qué fueron — ver regla en `CATEGORIZATION.md`.
