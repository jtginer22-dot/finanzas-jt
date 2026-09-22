# Reglas de categorización — Finanzas JT

Vivo mientras José categoriza. Cada regla nueva se agrega aquí cuando surge una duda real (en el chat) y se resuelve, para no volver a preguntarla.

## Principios
- **Todo movimiento se categoriza.** El tema nunca es "esto no se categoriza", es encontrar la categoría correcta.
- **`no_gasto`** se reserva para traspasos entre cuentas propias del mismo usuario (ej. de Cuenta Vista a Cuenta Corriente, pago de la propia TC desde la cuenta corriente). No es una categoría cajón de sastre.
- **Costos financieros son gasto real** y se categorizan como tal (ver abajo) — no se excluyen del análisis.
- **Ante duda, se conversa en el chat con Claude Code.** Si la regla resultante es reutilizable (aplica a más de un movimiento futuro), se agrega a este documento.

## Categorías para costos financieros (confirmado por José, 22-sep-2026)
- **Costo financiero**: intereses de mora, intereses rotativos, impuesto línea de crédito, intereses línea de crédito.
- **Avance en efectivo**: "Avance Normal TEF", "Avance en Efectivo".
- Objetivo: poder ver cuánto le cuesta a José usar crédito/rotativo por separado del consumo real, no mezclado.

## Regla de granularidad: Categoría vs. Etiqueta vs. Notas (actualizado 22-sep-2026)
El sistema tiene **tres** niveles, no dos — justamente para no tener que elegir entre "muy granular" y "muy consolidado" en ningún punto:
- **Categoría** (~20 definidas en la pestaña `Categorias`: Restaurantes, Entretenimiento, Transporte, Salud, Supermercado, etc.) — el balde grande sobre el que se arma el dashboard y la consolidación mensual. **Mantener chico y estable**: agregar una categoría nueva solo si es un TIPO de gasto recurrente que José quiere ver como su propia línea en el dashboard — nunca por un gasto puntual o una situación específica.
- **Etiqueta** — para agrupar/filtrar movimientos que se repiten bajo un mismo concepto reutilizable: "Trabajo", "Amigos", "Polola", "Viaje", "Restaurantes". Tiene que ser algo que tenga sentido volver a usar en OTRO movimiento futuro. Si el nombre que se te ocurre es tan específico que es literalmente imposible que se repita ("Regalo Juan Undurraga", "Ticket Ski Trini", "Almuerzo Bernardo", "Pasaje Despedida Cristobal Sturms" — todas ya creadas antes de esta regla), **no es una etiqueta, es una nota**.
- **Notas** (campo de texto libre, nuevo 22-sep-2026, en Categorizar y en Editar gasto) — el detalle único de ESE movimiento puntual: quién, dónde, por qué, cualquier cosa que quieras poder leer después pero que no tiene sentido usar para filtrar. Aquí sí, granularidad totalmente libre, cero costo — no aparece en ningún selector ni ensucia nada.

**Regla práctica**: categoría = "¿qué TIPO de gasto es?" (para sumar). Etiqueta = "¿bajo qué concepto reutilizable agrupo esto?" (para filtrar). Notas = "¿qué necesito recordar de ESTE movimiento en particular?" (para leer, no para filtrar). Si al crear una etiqueta el nombre incluye un nombre propio de una persona/evento que no se va a repetir, va en Notas, no en Etiquetas.

**Limpieza completada (22-sep-2026)**: las etiquetas hiper-específicas "Regalo Juan Undurraga", "Ticket La Parva Trini", "Almuerzo Bernardo", "Pasaje Despedida Cristobal Sturms", "Pasaje Rio", "Notaria Souvenir Chile" ya fueron quitadas por José (movidas a Notas vía el botón Editar). No queda acción pendiente sobre esto.

## Supermercado vs. Restaurantes vs. Snacks (22-sep-2026)
- **Supermercado**: compras de insumos/productos para preparar o consumir en casa — sea comida diaria, un asado con amigos, lo que sea. La categoría refleja el TIPO de compra (supermercado), no la ocasión (esa va en la etiqueta).
- **Restaurantes**: pagar por comida ya preparada/servida en un local, en una comida planeada (almuerzo, cena, bar).
- **Snacks** (antes `Comida`, renombrada 22-sep-2026 — mismo ID `mst2u7edkjw`, no se perdió el historial): compras chicas, impulsivas, fuera de horario de comida — un café en la calle, un helado, agua, algo para picar. Es un tipo de gasto real y recurrente (no una situación puntual), por eso se justifica como categoría propia en vez de etiqueta. Se reasignó también el único gasto que ya la usaba (EL TOLDO AZUL, $3.500, 01-jul-2026).

## Categoría `Otros` — para lo que no tienes certeza (22-sep-2026)
Cuando el nombre del cobro es poco descriptivo y no tienes cómo saber con certeza qué fue, se categoriza como **Otros** en vez de adivinar o dejarlo pendiente indefinidamente. No es lo mismo que `no_gasto` (que exige certeza de que es un traspaso propio) — `Otros` es explícitamente "gasto real, tipo desconocido".
**Guardrail**: `Otros` no debe volverse un cajón de sastre silencioso — si empieza a acumular un monto relevante mes a mes, vale la pena revisarlo (quizás la mayoría son la misma cosa recurrente y merecen su propia categoría o etiqueta).

## Costo financiero 100% trasladable a un tercero (ej. préstamo a Papá, 22-sep-2026)
Cuando José le presta plata a alguien usando su línea de crédito o TC, y esa persona asume también el costo financiero (intereses, impuesto/timbre) mientras el préstamo esté vigente — confirmado con José que este es el caso con Papá, 100% del interés de julio es atribuible al préstamo, sin mezcla con otro uso:
- **Categoría**: `Costo financiero` (no cambia — sigue siendo la categoría correcta para el tipo de cargo).
- **Mecánica para que no quede como gasto tuyo**: al categorizar, "¿Es compartido?" → modo con monto editable (antes "Con polola", hoy sirve para cualquier persona), persona = quien corresponda (ej. Papá), **"A cobrar" = el monto completo del cargo** (no la mitad). Esto dejá `montoPersonal = 0` (no te pega el costo) y genera una Cuenta por Cobrar por el 100% a esa persona.
- Se repite cada mes que el préstamo siga vigente y sigan apareciendo cargos de interés/impuesto de línea de crédito o TC — mismo patrón cada vez.
- **Nota sin resolver**: los movimientos "AMORTIZACION A LINEA DE CREDITO" y "PAGO PRESTAMO..." que aparecen junto a estos intereses son de otra naturaleza (pago de capital, no costo financiero) — no se decidió su categorización en esta sesión, se resuelve cuando José llegue a esas filas.

## Casos ya resueltos
- **Cerveza en after office con compañeros de trabajo** → Categoría `Restaurantes`, Etiqueta `Trabajo`. No se creó categoría nueva ("After office") porque es la historia del gasto (etiqueta), no un tipo de gasto nuevo.
- **Carne para asado con un amigo, comprada en el supermercado** → Categoría `Supermercado`, Etiqueta `Amigos`. La compra fue en el supermercado — el motivo (asado, amigo) es la etiqueta, no cambia la categoría.
- **Café en la calle / helado en la tarde** → Categoría `Snacks`. Distinto de Restaurantes porque no es una comida planeada; distinto de Supermercado porque no es para preparar algo en casa.

## Etiqueta `Invité` (22-sep-2026)
Cuando un gasto se marca como "Invité yo" al categorizar, se agrega automáticamente la etiqueta reutilizable `Invité` (además de las que José elija) y una nota `Invité a <persona>`. El gasto completo queda como propio de José (no genera Cuenta por Cobrar) — el objetivo es poder ver, filtrando por esa etiqueta en Historial, cuánto gasta invitando en un período. Distinto de "Con polola 50/50" o "Dividir con otras personas", que sí generan una deuda a cobrar.

## Cómo se relaciona con `no_gasto` y con Cuentas_Por_Cobrar
- Un préstamo a un tercero o un trámite pagado por José que después se cobra va a `Cuentas_Por_Cobrar`, tipo `prestamo` o `tramite_terceros` (no es gasto propio, aunque salga de la tarjeta de José).
- Un gasto compartido (tipo `compartido`) sí es gasto de José por el monto que le corresponde a él.
