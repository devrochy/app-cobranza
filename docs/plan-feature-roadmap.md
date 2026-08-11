# Roadmap de ejecución: comandos `/plan-feature` por historia

> Uso: dentro de `opencode` en `/Users/roaguilar/Projects/app-cobranza`, ejecuta un comando a la vez en el orden indicado.
> Regla: `/plan-feature <comando>` → aprobar enfoque → `/start-task <resumen>` → TDD (rojo→verde→refactor) → `/verify` antes de cerrar.
> Solo se pasa a la siguiente historia cuando la anterior cumple el Definition of Done de `AGENTS.md`.

---

## Fase 1 — MVP local

### Épica 1 — Gestión de identidad, roles y jerarquía (Admin → Socio → Cobrador)

> HU-01 primero: es prerrequisito lógico del resto (todo acceso pasa por el login).

1. `/plan-feature Login de administrador con usuario y contraseña sobre HTTPS (HU-01)`
2. `/plan-feature Registrar socio con usuario, contraseña, nombre, apellido, correo, teléfono, código, moneda y estatus (HU-02)`
3. `/plan-feature Registrar cobrador asociado obligatoriamente a un socio existente (HU-03)`
4. `/plan-feature Editar datos de socio o cobrador sin visualizar la contraseña anterior (HU-04)`
5. `/plan-feature Bloquear o activar socio y cobrador, con bloqueo en cascada de rutas del cobrador (HU-05)`
6. `/plan-feature Matriz de permisos por socio (HU-06)`
7. `/plan-feature Acceso del socio limitado a sus permisos habilitados (HU-07)`

### Épica 2 — Gestión de rutas y configuración operativa

8. `/plan-feature Registrar ruta con nombre, descripción, socio, cobrador, tipo de interés, número de cuotas y moneda (HU-08)`
9. `/plan-feature Editar el nombre de una ruta existente sin alterar su configuración (HU-09)`
10. `/plan-feature Matriz de parámetros por ruta (ruta_config) para controlar la app móvil en campo (HU-10)`
11. `/plan-feature Registrar inyección de capital con valor y comentario sobre una ruta (HU-11)`
12. `/plan-feature Eliminar inyección con confirmación conservando trazabilidad de fecha/hora (HU-12)`
13. `/plan-feature Código de color por cliente según nivel de atraso: azul, rojo y blanco (HU-13)`

### Épica 3 — Gestión de cartera: clientes, préstamos, pagos, abonos y gastos

14. `/plan-feature Registrar préstamo a cliente respetando el cupo máximo configurado en la ruta (HU-14)`
15. `/plan-feature Registrar pago de cuota o abono parcial manteniendo caja de la ruta (HU-15)`
16. `/plan-feature Registrar motivo de no pago de un cliente (HU-16)`
17. `/plan-feature Registrar y eliminar gasto operativo de ruta con trazabilidad de quién y aprobación (HU-17)`
18. `/plan-feature Reporte diario de ruta con mapa de ubicación de clientes y trayecto del cobrador (HU-18)`
19. `/plan-feature Consulta de quién pagó y quién no por día o semana con acceso directo a WhatsApp del moroso (HU-19)`

### Épica 4 — Reportes y liquidaciones

20. `/plan-feature Generar liquidación semanal de ruta con comisión calculada automáticamente (HU-20)`
21. `/plan-feature Agregar comentario libre a cada liquidación generada (HU-21)`
22. `/plan-feature Historial de liquidaciones anteriores con exportación a Excel (HU-22)`

### Épica 5 — Panel administrativo

23. `/plan-feature Dashboard consolidado multi-ruta y multi-socio con indicadores clave (HU-23)`
24. `/plan-feature Panel de monitoreo en vivo de conversaciones del asistente de IA (HU-24)`
25. `/plan-feature Configuración de límites financieros y reglas de negociación del asistente de IA (HU-25)`
26. `/plan-feature Alertas de casos que requieren intervención humana detectados por la IA (HU-26)`

### Épica 6 — Asistente de IA de Cobranza por WhatsApp (diferenciador)

> Requiere HU-25 (reglas de negociación) y HU-26 (derivación) antes de HU-31 y HU-32.

27. `/plan-feature Consulta de saldo, próxima cuota y fecha de vencimiento por WhatsApp (HU-27)`
28. `/plan-feature Registro de promesa de pago en lenguaje natural (HU-28)`
29. `/plan-feature Negociación de refinanciación o abono parcial por WhatsApp (HU-29)`
30. `/plan-feature Recordatorios proactivos de vencimiento y alertas automáticas de mora (HU-30)`
31. `/plan-feature Evaluación de cada negociación contra las reglas configuradas antes de confirmar (HU-31)`
32. `/plan-feature Detección y derivación a agente humano de casos complejos o solicitud de persona (HU-32)`
33. `/plan-feature Historial completo de conversación para el agente antes de tomar un caso derivado (HU-33)`
34. `/plan-feature Promesas de pago y acuerdos de refinanciación como entidades auditables vinculadas al préstamo (HU-34)`

### Épica 7 — Optimización de Rutas Inteligente

> Fase 1: se construye y prueba con coordenadas simuladas (sin GPS real).

35. `/plan-feature Ruta óptima diaria calculada desde la geolocalización de clientes con pago pendiente (HU-35)`
36. `/plan-feature Recalculo dinámico de la ruta ante indisponibilidad o pago digital anticipado (HU-36)`
37. `/plan-feature Enlace de navegación Google Maps o Waze con el orden estricto de la ruta (HU-37)`
38. `/plan-feature Auditoría del trayecto planificado versus el realmente recorrido (HU-38)`
- **HU-44 (OPCIONAL):** No ejecutar hasta entregar estimación de costo (infraestructura tiempo real + batería/datos del cobrador) y decisión explícita — ver sección 6.2 del PRD.
  - `/plan-feature Ubicación en tiempo real del cobrador durante la jornada, con estimación de costo previa (HU-44)`

### Épica 8 — Protocolo de Seguridad y Control de Dispositivos

> Fase 1: IMEI/WhatsApp simulados (mock de validación de dispositivo).

39. `/plan-feature Vincular número de WhatsApp del cobrador con el IMEI de su dispositivo (HU-39)`
40. `/plan-feature Cifrar ruta e itinerario del día y liberarlos solo tras validar el IMEI registrado (HU-40)`
41. `/plan-feature Registrar timestamp y coordenadas al abrir la ruta del día (auditoría) (HU-41)`
42. `/plan-feature Alerta de acceso a ruta desde dispositivo o número no autorizado (HU-42)`
43. `/plan-feature Re-vinculación del IMEI autorizado de un cobrador por cambio de equipo (HU-43)`

---

## Notas de ejecución

- **HU-44** está condicionada a análisis de costo (PRD 6.2). Por defecto se difiere.
- **Épicas 6, 7 y 8** en Fase 1 se prueban con simuladores/mocks; la integración real (WhatsApp Business API, GPS en vivo, IMEI físico) corresponde a Fase 2.
- Si una historia genera dependencias no previstas, actualiza este archivo antes de continuar.
- Cada `/plan-feature` debe citar la HU en `docs/APP_REQUIREMENTS.md` y proponer el enfoque antes de escribir código.
