# ADR-0003: Proveedor de métodos de pago para el cobro a socios — global vs local

- **Estado:** propuesta (pendiente de validación del marco ponderado)
- **Fecha:** 2026-08-26
- **Referencias:** docs/APP_REQUIREMENTS.md §6.4 (:416-429); docs/estrategia-metodos-pago-socios.md

## Contexto

El cobro mensual a socios (HU-60) requiere que el socio pague su cobro online mediante un **link/orden de pago** (`links_pago`), en la moneda del socio, en hasta **13 países** (PRD 6.4:417). Los métodos de pago dominantes son **locales** (PIX en Brasil, SPEI/OXXO en México, PSE/Efecty en Colombia, Yape/Plin en Perú, Pago Fácil/Rapipago en Argentina, Webpay en Chile, Redpagos/Abitab en Uruguay, etc.) además de tarjetas internacionales. Ningún proveedor global cubre toda la región como cuenta de merchant (Stripe opera en LatAm solo en Brasil y México).

Se necesita decidir la arquitectura de proveedores: **un orquestador global/regional** (un solo merchant recauda en todos los países) vs. **múltiples integraciones locales** (un proveedor por país).

## Marco de decisión ponderado

| Criterio | Peso | Qué mide |
|---|---|---|
| Cobertura de países | 30% | ¿Cubre los 13 países objetivo con métodos locales? |
| Costo por transacción | 25% | Comisiones y fees por método/país |
| Regulación/estabilidad | 20% | Onboarding, cumplimiento, riesgo de operación |
| Rapidez de integración | 15% | API, documentación, SDK |
| Monedas / tipo de cambio | 10% | Soporte de monedas locales y FX justo |

## Decisión

**Adoptar un orquestador regional con cobertura amplia (dLocal, con EBANX como alternativa) como proveedor principal, complementado con tarjetas internacionales y Mercado Pago como billetera local donde sea dominante.**

Es decir: **estrategia "global + locales complementarios"** (PRD 6.4:421), donde un **solo proveedor orquestador** expone los métodos locales por país (en lugar de integrar N proveedores locales). La integración local punto-a-punto solo se añade cuando un país lo exija (p. ej. regulación específica) o cuando el costo del orquestador no sea competitivo.

### Evaluación contra el marco

*(Sección que en los ADR-0001/0002 se llama "Justificación"; aquí se expresa como tabla ponderada contra el marco del Contexto.)*

| Criterio | Orquestador regional (dLocal/EBANX) | N proveedores locales | Stripe/PayPal (global) |
|---|---|---|---|
| Cobertura (30%) | **Alta** (casi todos los 13 países) | Alta por país, pero exige N contratos/onboarding | **Muy baja** (Stripe solo Brasil y México; PayPal merchant limitado) |
| Costo (25%) | **0.99–7.99%** según método (PIX 0.99%, transferencia AR 1.99%) | Similar o menor por método, pero multiplicado por integración | **Alta** (~2.9–3.5% + FX) |
| Regulación (20%) | **Onboarding único**; pagos locales cumplen el país destino | N onboards, N compliance | Onboarding simple donde opera, pero cobertura insuficiente |
| Integración (15%) | **Una API** para todos los métodos | N integraciones (mayor esfuerzo/riesgo) | Buena API, cobertura insuficiente |
| Monedas/FX (10%) | **Sí** (moneda local por país, FX del orquestador) | Sí | Parcial, FX con spread |

## Alternativas consideradas

- **Stripe/PayPal global**: descartado por cobertura insuficiente en la región como merchant (LatAm) y FX/costos altos.
- **Integración local por país** (Mercado Pago en AR/BR/MX/CL/CO/PE/UY + proveedores PIX/SPEI/PSE locales): viable pero multiplica contratos, compliance e integraciones; se reserva como *fallback* si el orquestador no cubre un país o su costo no es competitivo.
- **Stablecoins (USDT/USDC)**: opción adicional para **Venezuela** (dolarización de facto); se evalúa en Fase 2 con validación regulatoria, no como núcleo.
- **Mantener mock indefinidamente**: no viable para producción (Fase 3).

## Consecuencias

- **MVP local**: sin cambios — el flujo sigue con `links_pago` (proveedor `mock`) y `POST /cobros-socio/:id/pago` (registro manual por admin).
- **Fase 2 (piloto)**: activar el orquestador (dLocal o EBANX) en 1-2 países; integrar webhook de confirmación idempotente por `link_pago_id`; fijar la política de tipo de cambio (decisión de negocio pendiente).
- **`links_pago` evoluciona** (diseño en docs/estrategia-metodos-pago-socios.md §6): proveedor parametrizado por país, estado `confirmando`, moneda/método/FX registrados.
- **Validación obligatoria** (AGENTS.md §4): cotización comercial y disponibilidad actual de cada orquestador antes de implementar; las tarifas publicadas cambian.
- **Actualizar**: este ADR se marca `aceptada` cuando el usuario valide el marco ponderado y la decisión.

## Fuentes

- docs/estrategia-metodos-pago-socios.md §3-4 (matriz y catálogo con URLs oficiales).
- dLocal pricing: https://dlocalgo.com/wp-content/uploads/2024/09/pricinglist.pdf
- Mercado Pago coverage: https://payatlas.com/payment-method/mercado-pago-5109
- Stripe global availability: https://stripe.com/global