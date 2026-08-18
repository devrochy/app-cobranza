# Roadmap de ejecución: comandos `/plan-feature` por historia

> Uso: dentro de `opencode` en `/Users/roaguilar/Projects/app-cobranza`, ejecuta un comando a la vez en el orden indicado.
> Regla: `/plan-feature <comando>` → aprobar enfoque → `/start-task <resumen>` → TDD (rojo→verde→refactor) → `/verify` antes de cerrar.
> Solo se pasa a la siguiente historia cuando la anterior cumple el Definition of Done de `AGENTS.md` (PR abierta + CI en verde).
> El orden de ejecución respeta dependencias: cimientos → núcleo transaccional → reportes → rutas/geolocalización → notificaciones/IA → cobros de socios → offline.

---

## Fase 0 — Cimientos (refactors y deuda técnica que bloquean)

> Requisito previo para bloquear de forma efectiva (HU-61), reutilizar lógica y preparar geografía.

1. `/plan-feature Revalidar el estado (activo/bloqueado) del usuario en cada request en JwtAuthGuard (HU-05/HU-61)`
2. `/plan-feature Transacción en cascada de bloqueo socio → cobradores → rutas (HU-05/HU-61)`
3. `/plan-feature Extraer helpers compartidos de ownership (assertOwned) y numericTransformer de los 6+ servicios (refactor)`
4. `/plan-feature Migrar lat/lng de cliente y préstamo a geography(Point) de PostGIS (ADR)`

## Fase 1 — Núcleo operativo de cartera (Épica 3)

> HU-14 (préstamos) ya está implementada; se amplía con los acuerdos de la sesión de revisión.

5. `/plan-feature Regla de días de cobro: ajuste de vencimiento por día no laborable (solo_domingos/domingos_y_feriados) y mora desde el día siguiente al cobro efectivo (HU-13/HU-15/HU-16)`
6. `/plan-feature Caja de ruta: saldo inicial obligatorio, saldo vivo, historial de ajustes y wiring con inyecciones (amplía HU-08/HU-11)`
7. `/plan-feature Registrar pago de cuota o abono con método de pago obligatorio al marcar la visita, actualizando caja (HU-15)`
8. `/plan-feature Registrar visita de cliente con resultado (pago/no pago), catálogo de motivos y promesa de pago por "compromiso de pago" (HU-46, amplía HU-16)`
9. `/plan-feature Registrar y aprobar gastos de ruta con evidencias (imágenes/PDF) y flujo de aprobación (HU-17)`
10. `/plan-feature Ampliar registro de cliente: dos direcciones, fotos facial/documento por flags, tope de deuda, fecha del préstamo ±30 días y fiador opcional (amplía HU-14)`
11. `/plan-feature Actualización de cliente con flujo de aprobación cuando el cobrador no tiene permiso (HU-47)`
12. `/plan-feature Gestión de cuotas y abonos con auditoría imborrable y re-autenticación de contraseña (HU-48)`
13. `/plan-feature Notas de ruta: crear, ver, editar y eliminar con historial (HU-45)`

## Fase 2 — Reportes y liquidaciones (Épica 4)

14. `/plan-feature Generar liquidación de ruta según su periodo configurado (diario/semanal/quincenal/mensual) con caja y comisión (HU-20)`
15. `/plan-feature Historial de reportes diarios y liquidaciones persistidos, consultable y exportable (HU-22/HU-50)`
16. `/plan-feature Detalle/resumen de ruta con visibilidad de datos sensibles por flags y permiso ver_cartera (HU-51)`

## Fase 3 — Rutas inteligentes y listas del día (Épica 7 + Épica 3)

17. `/plan-feature Segmentar la ruta del día en trayectos de hasta 9 paradas con clustering geográfico y orden por vecino más cercano (HU-55, amplía HU-35/36)`
18. `/plan-feature Lista de clientes del día (snapshot + actualización al notificar visitas) con colores verde/rojo y exclusión de trayectos (HU-56)`
19. `/plan-feature Mapa de clientes desde listas del día y pendientes con markers (negocio/domicilio) (HU-57)`
20. `/plan-feature Tarjeta de cliente en las listas: foto, tipo de pago, negocio, color, teléfono, saldo y días de mora (HU-58)`
21. `/plan-feature Navegación al cliente desde su detalle con enlaces Google Maps/Waze (HU-59, amplía HU-37)`
22. `/plan-feature Persistir trayectorias planificada y real en el reporte diario con GeoJSON (HU-49, amplía HU-18/HU-38)`

## Fase 4 — Notificaciones e IA (Épica 6)

> Requiere el simulador de WhatsApp y el motor de notificaciones antes de las HUs de conversación.

23. `/plan-feature Infraestructura del simulador de WhatsApp y motor de programación de notificaciones`
24. `/plan-feature Notificaciones de pago de cuota en ciclo completo (antes/durante/después) con config por ruta (HU-52, amplía HU-30)`
25. `/plan-feature Historial unificado de conversación con el cliente, chat por simulador y enlace wa.me (HU-53, amplía HU-19/HU-33)`
26. `/plan-feature Tarjeta/estado de cuenta del préstamo y envío del reporte por WhatsApp (HU-54, amplía HU-27)`
27. `/plan-feature Configuración de límites financieros y reglas de negociación del asistente de IA (HU-25)`
28. `/plan-feature Consulta de saldo y próxima cuota por WhatsApp (HU-27)`
29. `/plan-feature Registro de promesa de pago en lenguaje natural (HU-28)`
30. `/plan-feature Negociación de refinanciación o abono parcial por WhatsApp (HU-29)`
31. `/plan-feature Evaluación de cada negociación contra las reglas configuradas antes de confirmar (HU-31)`
32. `/plan-feature Detección y derivación a agente humano de casos complejos (HU-32)`
33. `/plan-feature Promesas de pago y acuerdos como entidades auditables vinculadas al préstamo (HU-34)`

## Fase 5 — Cobros de socios y pagos (Épica 9)

34. `/plan-feature Configuración del socio: nombre de oficina de cobro y campos de configuración (HU-62)`
35. `/plan-feature Cobro mensual a socios: costo base por ruta, fecha de cobro anclada al alta, historial de cobros y notificaciones antes/durante/después (HU-60)`
36. `/plan-feature Bloqueo automático por mora de cobro con job diario y auto-habilitación al pagar (HU-61)`
37. `/plan-feature Conversaciones Admin↔Socio: historial unificado, chat por simulador y enlace wa.me (HU-63)`
38. `/plan-feature Estrategia y diseño de métodos de pago para socios (sección 6.4 del PRD) con ADR de proveedor global vs local`

## Fase 6 — Offline y sincronización (Épica 10, transversal)

39. `/plan-feature API de sincronización de eventos offline con idempotencia por ID de dispositivo (HU-64)`

---

## Notas de ejecución

- **HU-44** sigue condicionada a análisis de costo (PRD 6.2). Por defecto se difiere.
- **Épicas 6, 7 y 8** en Fase 1 se prueban con simuladores/mocks; la integración real (WhatsApp Business API, GPS en vivo, IMEI físico) corresponde a Fase 2.
- **Épica 9** en Fase 1 usa un proveedor de pago mock y registro manual; los proveedores reales se integran en Fase 2/3 (PRD 6.4).
- **Épica 10** en Fase 1 construye solo la API de sincronización; la APK offline real es Fase 2 (PRD 6.5).
- Si una historia genera dependencias no previstas, actualiza este archivo antes de continuar.
- Cada `/plan-feature` debe citar la HU en `docs/APP_REQUIREMENTS.md` y proponer el enfoque antes de escribir código.