# Estrategia de métodos de pago para el cobro mensual a socios (PRD 6.4)

- **Estado:** en revisión (entregable de diseño, no implementación)
- **Fecha:** 2026-08-26
- **Base:** docs/APP_REQUIREMENTS.md §6.4 (:416-429). La integración real de proveedores se ejecuta en Fase 2/3; el MVP local simula el flujo con `links_pago` (proveedor `mock`).

## 1. Objetivo y alcance

Garantizar el mejor método de pago para el **cobro mensual a socios** (HU-60) en Suramérica y Centroamérica. Cada cobro genera un **link/orden de pago** (`links_pago`) que el socio abre desde la APK o el panel y completa con su método; el sistema registra la confirmación en `cobros_socio`/`links_pago`.

Países en alcance (PRD 6.4:417): **Colombia, Brasil, Venezuela, Perú, Bolivia, Chile, Argentina, Uruguay, Paraguay, Panamá, El Salvador, Guatemala** y el resto de la región.

El pago se hace en la **moneda del socio**; si el proveedor no soporta esa moneda, se muestra el equivalente con tipo de cambio al momento de pagar (PRD 6.4:423).

> Nota de distinción: los `metodo_pago` presenciales de la cartera (`metodo-pago.ts`: efectivo/qr/transferencia/tarjeta/deposito) son de las visitas de cobranza. El cobro al socio es un pago **online** por link y se modela con su propio ciclo (`links_pago`).

## 2. Métodos de pago por país (catálogo)

Medios dominantes para pagos online/transferencias (investigación 2026, fuentes en §7):

| País | Métodos locales dominantes | Observaciones |
|---|---|---|
| Brasil | **PIX** (dominante, ~40% del e-commerce online en 2026), Boleto, tarjetas | PIX: >170M usuarios, ~90% adopción adulta, instantáneo, 24/7 |
| México | **SPEI**, OXXO (efectivo), tarjetas, CoDi (adopción baja) | DiMo (Banxico) con adopción lenta |
| Colombia | **PSE** (transferencia), Efecty (efectivo), tarjetas | |
| Perú | **Yape** y otras billeteras digitales (dominantes; >65% de los pagos de bajo valor), Pago Efectivo, tarjetas | |
| Argentina | **Pago Fácil / Rapipago** (efectivo), transferencia bancaria, tarjetas, Mercado Pago | Mercado Pago muy arraigado |
| Chile | **Webpay** (transferencia), Servipag, tarjetas | |
| Uruguay | **Redpagos / Abitab**, transferencia, tarjetas | |
| Paraguay | Pago Express, tarjetas | |
| Panamá | Punto Pago (efectivo), tarjetas | |
| El Salvador | Efectivo, tarjetas | Billeteras en adopción |
| Guatemala | Efectivo, tarjetas | Banca con baja penetración |
| Bolivia | Transferencia bancaria (Banco Nacional de Bolivia), tarjetas | dLocal: tarjetas "coming soon" |
| Venezuela | Efectivo/USD, transferencias locales, stablecoins (USDT) | Mercado con fuerte dolarización de facto |

**Patrón regional:** tarjetas (Visa/Mastercard) + **cash vouchers / transferencias locales** dominan; los países sin un método de transferencia instantánea masivo dependen de tarjetas y efectivo.

## 3. Proveedores evaluados

### Globales
- **Stripe** — sólido en Norteamérica/Europa/Asia-Pacífico; en LatAm opera como cuenta de negocio solo en **Brasil y México** entre los ~46 países soportados (2025). **No cubre la región como cuenta de merchant.**
- **PayPal** — acepta pagos desde casi cualquier país, pero onboarding de merchant y retiros locales son limitados; comisiones altas y FX desfavorable.
- **Wise / Payoneer** — transferencias globales y pagos a proveedores; **no están orientados a cobrar por link con métodos locales** (PIX/SPEI/PSE), por lo que se descartan para este caso de uso.
- **Stablecoins (USDT/USDC)** — relevante para Venezuela y remesas; requiere rampa local y manejo regulatorio; no es un método "típico" para el cobro a socios.

### Regionales / infraestructura local
- **Mercado Pago** — el mayor facilitador de pagos en LatAm, líder de billeteras en la región (Argentina, Brasil, México, Chile, Colombia, Perú, Uruguay); QR, tarjetas, efectivo y transferencias. Requiere cuenta de merchant por país.
- **dLocal** — orquestador con **cobertura única por región**: Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Rep. Dominicana, Ecuador, El Salvador, Guatemala, Honduras, México, Nicaragua, Panamá, Paraguay, Perú, Uruguay. Un solo merchant (en un país) recauda en todos. Métodos locales por país (PIX, SPEI, CODI, PSE, OXXO, Boleto, Efecty, Pago Fácil, Rapipago, Webpay, Redpagos, Abitab, Punto Pago, etc.).
- **EBANX** — similar a dLocal (LatAm); popular en Brasil.

## 4. Matriz de evaluación (resumen)

| Proveedor | Cobertura 13 países | Costo por transacción* | Monedas locales | Regulación/onboarding | Integración |
|---|---|---|---|---|---|
| Stripe | Muy baja (solo Brasil y México) | ~2.9% + FX (estimación) | Parcial | Sencillo donde opera | Muy buena API |
| PayPal | Media (receptivo en casi todos, merchant limitado) | Alta (~3.5% + FX, estimación) | Parcial | Media | Buena API |
| Mercado Pago | Media (7 países) | ~2-4% por país (estimación) | Sí | Cuenta por país | Buena API/SDK |
| **dLocal** | **Alta (casi todos los 13)** | **0.99–7.99% según método/país** (publicado: PIX 0.99%, transfer AR 1.99%, MX 2.49–2.99%, EC cards 7.99%) | **Sí** | Merchant único + pagos locales | API; costos por cotización |
| EBANX | Media-alta | ~3-5% (estimación) | Sí | Merchant único | Buena API |

\* Las tarifas de Stripe/PayPal/Mercado Pago/EBANX son **estimaciones a validar con cotización comercial** (AGENTS.md §4); solo las de dLocal provienen de su tarifario publicado (ver §7). No incluyen impuestos locales ni spread de FX.

## 5. Estrategia recomendada: **global + locales complementarios** (PRD 6.4:421)

1. **Núcleo regional con cobertura total: dLocal** (o EBANX como alternativa) como orquestador principal. Un solo contrato de merchant recauda en los 13 países usando los métodos locales dominantes (PIX, SPEI, PSE, OXXO, Boleto, Webpay, Pago Fácil, etc.), en la moneda de cada socio, sin abrir entidad legal por país.
2. **Tarjetas internacionales** como método global complementario (disponible en la mayoría de los países vía el mismo orquestador), para socios con tarjeta.
3. **Mercado Pago como método local complementario** donde sea dominante (Argentina, Brasil, México, Chile, Colombia, Perú, Uruguay), expuesto como una billetera dentro del mismo link de pago.
4. **Venezuela**: considerar stablecoin (USDT) como opción adicional dado el contexto de dolarización de facto — validar regulación en la implementación.
5. El **link/orden por cobro** (HU-60) encapsula la elección: el backend genera el link con el proveedor activo del país del socio y el socio elige el método.

**Decisión global vs local — ver ADR-0003** (`docs/ai/decisions/0003-metodos-pago-proveedor-global-vs-local.md`).

## 6. Diseño de `links_pago` y confirmaciones para Fase 2/3

Modelo actual (HU-60, MVP mock): `links_pago(id, cobro_socio_id, url, estado, proveedor='mock', created_at)` con `estado ∈ {generado, pagado, vencido}`.

Evolución recomendada (sin implementar en este ítem):
- **Proveedor parametrizado por país**: `socios.pais` (HU-62) selecciona el proveedor activo del catálogo.
- **Flujo**: generar link → socio paga en el proveedor → webhook/confirmación del proveedor → marcar `links_pago.estado='pagado'` → `cobros_socio.estado='pagado'` (dispara HU-61 auto-habilitación).
- **Confirmaciones**: exponer un endpoint de webhook por proveedor (idempotente por `link_pago_id`) y un estado intermedio `confirmando` mientras se valida la notificación.
- **Moneda/FX**: guardar en `links_pago` la moneda del socio, el método elegido y el monto en la moneda base del proveedor si aplica conversión; la política de tipo de cambio (quién absorbe el spread) se fija en Fase 2 como decisión de negocio.

## 7. Fuentes consultadas (2026-08)

- Stripe global availability: https://stripe.com/global
- Stripe supported countries 2026 (resumen): https://redstagfulfillment.com/how-many-countries-does-stripe-operate-in/
- dLocal pricing (payins por país y método): https://dlocalgo.com/wp-content/uploads/2024/09/pricinglist.pdf
- dLocal LatAm payment processors: https://www.dlocal.com/payment-processors-in-latin-america/
- dLocal Go fees: https://helpcenter.dlocalgo.com/en/articles/6960181-dlocal-go-fees
- Mercado Pago coverage/uso: https://payatlas.com/payment-method/mercado-pago-5109
- Mercado Pago métodos (BigCommerce): https://support.bigcommerce.com/s/article/Mercado-Pago-Payment-Methods
- PIX Brasil (volumen/adopción): https://www.transfi.com/blog/how-does-brazils-payment-system-work-pix-ted-and-doc-explained
- PIX ~40% e-commerce online en 2026 (Reuters/EBANX): https://1027wbow.com/2024/01/25/brazils-pix-to-reach-40-of-online-payment-market-by-2026-ebanx-study-shows/
- Métodos de pago LatAm por país: https://wiio.com/top-e-commerce-payment-methods-in-latin-america/
- Comisiones Mercado Pago LatAm 2026: https://www.guiadebancos.com/cl/blog/comisiones-mercado-pago-latam-2026

> Las tarifas y disponibilidad cambian con frecuencia; la implementación (Fase 2/3) debe re-validar con la documentación oficial de cada proveedor (AGENTS.md §4).