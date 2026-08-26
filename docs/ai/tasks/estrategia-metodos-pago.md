# Tarea: Estrategia y diseño de métodos de pago para socios con ADR global vs local (PRD 6.4)

- **Origen:** Roadmap Fase 5 ítem 38 (docs/plan-feature-roadmap.md:70) — sección 6.4 del PRD (docs/APP_REQUIREMENTS.md:416-429). No es una HU; es tarea de diseño/estrategia.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-26

## Objetivo
Producir la estrategia de métodos de pago para el cobro mensual a socios: catálogo por país (13 países de PRD 6.4:417), evaluación de proveedores con fuentes oficiales (AGENTS.md §4), estrategia global + locales y el ADR-0003 "proveedor global vs local". **Solo documentación, sin integración de proveedores** (PRD 6.4:420, Fase 2/3).

## Fuera de alcance
- Integración real de proveedores (Fase 2/3).
- Cambios de código en `cobros_socio`/`links_pago` / `metodo_pago`.
- Mejora del mock de pago.
- Política definitiva de tipo de cambio: se documenta como decisión o pendiente explícito en el ADR.

## Bloques (checklist)
- [x] Bloque 1: Investigación de proveedores globales (tarjetas internacionales, transferencias Wise/Payoneer, stablecoins/ramp) con `webfetch`/`websearch` de documentación oficial y URLs citadas.
- [x] Bloque 2: Investigación de métodos de pago locales por país (PIX Brasil, SPEI/CoDi México, PSE Colombia, Yape/Plin Perú, Pago Fácil/Rapipago Argentina, etc.) con fuentes oficiales.
- [x] Bloque 3: Redacción `docs/estrategia-metodos-pago-socios.md`: catálogo por país, matriz de evaluación de proveedores (costo por transacción, cobertura, monedas, regulación), estrategia global + locales, diseño de `links_pago`/confirmaciones y moneda/FX para Fase 2/3.
- [x] Bloque 4: Redacción ADR-0003 `docs/ai/decisions/0003-metodos-pago-proveedor-global-vs-local.md` con el marco ponderado (cobertura 30%, costo 25%, regulación 20%, integración 15%, monedas/FX 10%) y la decisión.
- [x] Bloque 5: Actualizar `docs/plan-feature-roadmap.md` (ítem 38 completado) y registrar seguimiento.
- Verificación: `scripts/check.sh` (sin cambios de código → debe seguir verde) + revisión del documento.

## Decisiones tomadas durante la implementación
- Estrategia: **orquestador regional con cobertura amplia (dLocal, alternativa EBANX)** como núcleo, complementado con tarjetas internacionales y Mercado Pago como billetera local; stablecoin (USDT) como opción adicional para Venezuela. (ADR-0003, estado `propuesta` pendiente de validación del marco.)
- Catálogo por país: 13 países de PRD 6.4:417, con métodos dominantes por país citando fuentes 2026.
- `links_pago` (Fase 2/3): proveedor parametrizado por país, estado intermedio `confirmando`, webhook idempotente por `link_pago_id`, registro de moneda/método/FX. Sin cambios de código en este ítem.
- Fuentes citadas: Stripe, dLocal (pricing PDF), Mercado Pago, PIX/Reuters, wiio, etc. (sección 7 del doc de estrategia).

## Ambigüedades resueltas con el usuario
- Pregunta: países del catálogo → **todos los de PRD 6.4:417** (Colombia, Brasil, Venezuela, Perú, Bolivia, Chile, Argentina, Uruguay, Paraguay, Panamá, El Salvador, Guatemala, resto).
- Pregunta: entregable → **solo documentación** (sin preparación de código).
- Pregunta: marco del ADR → **propuesta ponderada a validar en el borrador**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (sin cambios de código → verde) + revisión de contenido de los documentos.
- Archivos modificados:
  - `docs/estrategia-metodos-pago-socios.md` (nuevo) — catálogo por país, matriz de evaluación, estrategia, diseño de `links_pago` para Fase 2/3, fuentes.
  - `docs/ai/decisions/0003-metodos-pago-proveedor-global-vs-local.md` (nuevo) — ADR con marco ponderado y decisión.
  - `docs/plan-feature-roadmap.md` — ítem 38 marcado como hecho.
  - `docs/ai/tasks/estrategia-metodos-pago.md` (este archivo).
- Revisión independiente (code-reviewer): realizada — inicialmente **RECHAZADO** por errores factuales (Stripe cubre Brasil y México, no solo Brasil; rango dLocal 0.99–7.99%, no 0.99–4.99%). **Corregidos** y **re-verificado: APROBADO sin bloqueantes** (B1-B4 y observaciones M1/m2 resueltos).
- Pendientes/seguimiento:
  - Validar el marco ponderado y la decisión del ADR-0003 (estado `propuesta` → `aceptada`).
  - Fase 2: cotización comercial real y disponibilidad actual de dLocal/EBANX (AGENTS.md §4) antes de integrar.
  - Política de tipo de cambio (quién absorbe el spread) — decisión de negocio pendiente.
  - Stablecoins (USDT) para Venezuela — validación regulatoria en Fase 2.