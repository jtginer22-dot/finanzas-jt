# Contexto — Finanzas JT

## Qué es esto
App de finanzas personales de José Tomás Giner Lazo (JT). Captura automática de movimientos bancarios desde el correo, categorización manual en una app web, y (visión de largo plazo) módulo base de un "LifeOS" personal con agentes de IA.

## Por qué existe (situación real de José, sep 2026)
José está sin trabajo y necesita ordenarse financieramente:
- Diagnóstico de en qué se le va la plata (gasto real por categoría).
- Cuánto tiene ahorrado y cuánto le dura (runway).
- Planificar compromisos futuros: viajes, arreglar el auto, potencialmente irse a vivir solo — decisiones que requieren flujo de caja proyectado, no solo histórico.

Los ingresos José los tiene claros y no son el problema — el foco real es el detalle y la categorización de gastos, y proyectar compromisos que hoy no están contemplados en ningún lado.

## Objetivo del sistema
1. Capturar automáticamente el 100% de los movimientos bancarios reales (sin intervención manual, con reconciliación contra lo que declara el banco).
2. Categorizar cada movimiento (todo se categoriza — el tema es encontrar la categoría correcta, incluyendo costos financieros como intereses de mora o avances, que también son gasto de tarjeta y hay que entender).
3. Dar visibilidad de ingresos, ahorro/inversiones y presupuesto por categoría.
4. Proyectar compromisos futuros (flujo de caja hacia adelante, no solo histórico) — pendiente de construir.

## Quién es quién en el sistema
- **José**: usuario único, categoriza en la app, toma las decisiones de negocio/producto.
- **Claude Code**: opera el repo, el Google Sheet (vía proxy) y el correo de José (solo lectura/búsqueda) para diagnosticar, construye y despliega el código de captura, mantiene esta documentación.
- **Google Apps Script**: corre la captura automática cada 10 min, sin intervención de Claude Code en tiempo real (Claude Code edita el código pero José lo pega y lo corre en su cuenta).

## Alcance actual vs. pendiente
- ✅ Captura automática de las 5 fuentes bancarias, con reconciliación validada contra el banco.
- ✅ Control automático de fechas imposibles.
- ⏳ Categorización real (~750 movimientos pendientes al 21-sep-2026).
- ⏳ Ingresos, Inversiones/ahorro, Presupuestos — pestañas vacías, sin ingresar todavía.
- ⏳ Módulo de compromisos futuros (viajes, cuotas del auto, etc.) — no existe, se construye después de categorizar jul/ago.
- ⏳ Backup automático diario — implementado en código, pendiente de activar (`configurarActivadores()`).

Ver [`ROADMAP.md`](ROADMAP.md) para el detalle priorizado.
