# Reglas de categorización — Finanzas JT

Vivo mientras José categoriza. Cada regla nueva se agrega aquí cuando surge una duda real (en el chat) y se resuelve, para no volver a preguntarla.

## Principios
- **Todo movimiento se categoriza.** El tema nunca es "esto no se categoriza", es encontrar la categoría correcta.
- **`no_gasto`** se reserva para traspasos entre cuentas propias del mismo usuario (ej. de Cuenta Vista a Cuenta Corriente, pago de la propia TC desde la cuenta corriente). No es una categoría cajón de sastre.
- **Costos financieros son gasto real** y se categorizan como tal (ver abajo) — no se excluyen del análisis.
- **Ante duda, se conversa en el chat con Claude Code.** Si la regla resultante es reutilizable (aplica a más de un movimiento futuro), se agrega a este documento.

## Categorías para costos financieros (propuestas, a confirmar con uso real)
- **Costo financiero**: intereses de mora, intereses rotativos, impuesto línea de crédito, intereses línea de crédito.
- **Avance en efectivo**: "Avance Normal TEF", "Avance en Efectivo".
- Objetivo: poder ver cuánto le cuesta a José usar crédito/rotativo por separado del consumo real, no mezclado.

## Casos ya resueltos
_(se va llenando con las dudas reales que surjan al categorizar)_

## Cómo se relaciona con `no_gasto` y con Cuentas_Por_Cobrar
- Un préstamo a un tercero o un trámite pagado por José que después se cobra va a `Cuentas_Por_Cobrar`, tipo `prestamo` o `tramite_terceros` (no es gasto propio, aunque salga de la tarjeta de José).
- Un gasto compartido (tipo `compartido`) sí es gasto de José por el monto que le corresponde a él.
