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

## Regla de granularidad: Categoría vs. Etiqueta (22-sep-2026)
El sistema ya tiene dos niveles distintos, pensados justamente para no tener que elegir entre "muy granular" y "muy consolidado":
- **Categoría** (~20 definidas en la pestaña `Categorias`: Restaurantes, Entretenimiento, Transporte, Salud, Supermercado, etc.) — el balde grande sobre el que se arma el dashboard y la consolidación mensual. **Mantener chico y estable**: agregar una categoría nueva solo si es un TIPO de gasto recurrente que José quiere ver como su propia línea en el dashboard — nunca por un gasto puntual o una situación específica.
- **Etiqueta** (ya hay decenas: "Trabajo", "Amigos", "Polola", "Regalo Juan Undurraga", "Almuerzo Bernardo"...) — el detalle/contexto de un movimiento específico. Acá **granularidad libre**, sin costo: se pueden poner varias etiquetas por movimiento y no diluye la consolidación porque el dashboard no se arma sobre etiquetas.

**Regla práctica**: la categoría responde "¿qué TIPO de gasto es?" (para sumar); la etiqueta responde "¿cuál es la historia de ESTE gasto?" (para buscar/recordar/filtrar después). Ante una duda de "¿necesito una categoría nueva?", la respuesta casi siempre es no — lo que se necesita es una etiqueta.

## Casos ya resueltos
- **Cerveza en after office con compañeros de trabajo** → Categoría `Restaurantes`, Etiqueta `Trabajo`. No se creó categoría nueva ("After office") porque es la historia del gasto (etiqueta), no un tipo de gasto nuevo.

## Cómo se relaciona con `no_gasto` y con Cuentas_Por_Cobrar
- Un préstamo a un tercero o un trámite pagado por José que después se cobra va a `Cuentas_Por_Cobrar`, tipo `prestamo` o `tramite_terceros` (no es gasto propio, aunque salga de la tarjeta de José).
- Un gasto compartido (tipo `compartido`) sí es gasto de José por el monto que le corresponde a él.
