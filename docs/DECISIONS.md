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

### 2026-09-22 — Arquitectura de contexto: carpeta `docs/` en Git
**Decisión**: crear `docs/CONTEXT.md`, `ARCHITECTURE.md`, `SOURCES.md`, `GUARDRAILS.md`, `DECISIONS.md`, `CATEGORIZATION.md`, `ROADMAP.md` como fuente de contexto y decisiones técnicas del proyecto, versionada junto al código.
**Por qué**: el contexto vivo estaba repartido entre Notion (que se congelaba entre sesiones) y un handoff local desactualizado, sin un lugar único para el "por qué" de las decisiones técnicas.
**Relación con Notion/Obsidian (CLAUDE.md)**: Notion sigue siendo para Tasks/backlog. Las decisiones durables de producto/estrategia personal, cuando Obsidian esté conectado, se canonizan ahí. Mientras esa captura automática no exista, `docs/DECISIONS.md` mantiene el registro técnico y de producto de este proyecto sin depender de ese paso manual.
**Mantenimiento**: cuando una decisión se toma en una sesión, se agrega a este archivo en el mismo commit que el cambio de código asociado (si lo hay).
