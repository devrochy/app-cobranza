# PRD — Plataforma de Préstamos y Cobranza con Asistente de IA

**Nombre de trabajo:** CobraIA (nombre provisional)
**Basado en:** Análisis de 18 videos tutoriales del sistema Smart 369 (gestión de préstamos y cobranza para prestamistas/cobradiarios), extendido con arquitectura de funcionalidades de IA conversacional, optimización de rutas y seguridad de dispositivos.
**Versión:** 1.0
**Fecha:** Agosto 2026

---

## 1. Objetivo principal de la app

Construir una plataforma SaaS multi-tenant para prestamistas y cobradiarios que digitalice el ciclo completo de préstamos y cobranza (rutas, clientes, cartera, pagos, abonos, gastos y liquidaciones), replicando las capacidades operativas validadas de Smart 369, pero añadiendo tres diferenciadores estratégicos:

1. **Un asistente de cobranza con IA operado 100% por WhatsApp**, que automatiza conversaciones de cobro, recordatorios, negociación de planes de pago dentro de límites configurados por el administrador, y que deriva a un humano cuando el caso lo requiere.
2. **Optimización inteligente de rutas de cobro**, que calcula el trayecto más corto y lo reorganiza dinámicamente según eventos en tiempo real (clientes no disponibles, pagos digitales anticipados).
3. **Un protocolo de seguridad y control de dispositivos** que vincula la identidad del cobrador (WhatsApp + IMEI) para proteger la información sensible de rutas, clientes y cartera frente a fugas o suplantación.

El resultado debe reducir la dependencia de métodos físicos/Excel, minimizar pérdidas de cartera por falta de seguimiento, y reducir el tiempo operativo del cobrador en campo, manteniendo el control administrativo centralizado que ya ofrece Smart 369 (roles, permisos granulares, reportes y liquidaciones).

---

## 2. Requerimientos funcionales (Historias de usuario)

Las historias se agrupan en 8 épicas. Las primeras 5 épicas están fundamentadas directamente en las funcionalidades observadas en los videos de Smart 369; las 3 últimas corresponden a la arquitectura de funcionalidades esperada (diferenciadores del producto).

### Épica 1 — Gestión de identidad, roles y jerarquía (Admin → Socio → Cobrador)

Basado en: registro/edición de socios, registro/edición de cobradores, bloqueo/activación, configuración de permisos de socio.

- **HU-01.** Como Administrador, quiero iniciar sesión con usuario y contraseña sobre un canal cifrado (HTTPS/TLS), para acceder de forma segura al panel administrativo.
- **HU-02.** Como Administrador, quiero registrar un Socio con usuario, contraseña, nombre, apellido, correo, teléfono, código, tipo de moneda y estatus, para habilitar la operación de una nueva cartera/negocio.
- **HU-03.** Como Administrador, quiero registrar un Cobrador asociado obligatoriamente a un Socio existente, para mantener la jerarquía Socio → Cobrador → Ruta.
- **HU-04.** Como Administrador, quiero editar los datos de un Socio o Cobrador (nombre, apellido, contraseña) sin poder visualizar la contraseña anterior, para permitir recuperación de acceso sin comprometer la confidencialidad de la credencial.
- **HU-05.** Como Administrador, quiero bloquear o activar a un Socio (bloqueando su acceso a la plataforma) y a un Cobrador (bloqueando en cascada todas sus rutas asignadas), para suspender operaciones ante mora, incumplimiento o desvinculación.
- **HU-06.** Como Administrador, quiero configurar una matriz de permisos por Socio (ej. eliminar rutas, eliminar préstamos, eliminar abonos/gastos/inyecciones, generar/ver/descargar reportes, bloquear cobradores, modificar cupos, registrar socios/cobradores/rutas, editar permisos), para delegar responsabilidades sin ceder control total de la plataforma.
- **HU-07.** Como Socio, quiero acceder únicamente a las funciones habilitadas por mis permisos, para operar dentro de los límites definidos por el Administrador.

### Épica 2 — Gestión de rutas y configuración operativa

Basado en: registro/edición de rutas, configuración de permisos de ruta (APK), inyecciones de capital.

- **HU-08.** Como Socio o Administrador, quiero registrar una Ruta con nombre, descripción, socio, cobrador, tipo de interés (%), número de cuotas y moneda, para habilitar un nuevo circuito de cobro.
- **HU-09.** Como Administrador, quiero editar el nombre de una ruta existente, para corregir o actualizar su identificación sin alterar su configuración operativa.
- **HU-10.** Como Administrador o Socio con permiso, quiero configurar una matriz de parámetros por ruta (cuotas mínimas de préstamo, umbral de cuotas en atraso, manejo de cupo y cupo por defecto, bloqueo de cambio de interés, comisión %, visibilidad de caja/cartera/préstamos, reconocimiento facial, permisos de eliminación de préstamos/pagos/gastos/abonos/inyecciones, bloqueo automático de clientes morosos, restricción de cambio de fecha de préstamo, borrado de clientes sin deuda), para controlar de forma granular lo que el cobrador puede hacer desde la app móvil en campo.
- **HU-11.** Como Administrador o Socio con permiso, quiero registrar una inyección de capital (valor + comentario) sobre una ruta, para reflejar aportes adicionales de caja de forma inmediata.
- **HU-12.** Como Administrador o Socio con permiso, quiero eliminar una inyección previamente registrada (con confirmación), para corregir errores de captura sin perder trazabilidad de fecha/hora.
- **HU-13.** Como sistema, quiero aplicar un código de color por cliente según su nivel de atraso (azul = bajo el umbral, rojo = sobre el umbral, blanco = nuevo o crédito finalizado), para que socios, administradores y cobradores identifiquen visualmente el riesgo de cartera.

### Épica 3 — Gestión de cartera: clientes, préstamos, pagos, abonos y gastos

Basado en: reportes diarios/semanales, gestión de gastos, notificaciones de no pago.

- **HU-14.** Como Cobrador, quiero registrar un nuevo préstamo a un cliente (valor, cuotas, ubicación) respetando el cupo máximo configurado en la ruta, para otorgar crédito dentro de los límites de riesgo definidos.
- **HU-15.** Como Cobrador, quiero registrar el pago de una cuota o un abono parcial de un cliente, para mantener actualizada la cartera y la caja de la ruta.
- **HU-16.** Como Cobrador, quiero registrar el motivo por el cual un cliente no pagó (ej. "no está", "pagó semanal y ya terminó"), para que el Administrador y el Socio tengan visibilidad del contexto de cobranza.
- **HU-17.** Como Cobrador o Administrador, quiero registrar y/o eliminar un gasto operativo (descripción, valor) asociado a la ruta, con trazabilidad de quién lo creó, si está aprobado y con marca de tiempo exacta, para auditar el flujo de caja diario.
- **HU-18.** Como Administrador o Socio, quiero visualizar el reporte diario de una ruta (cobrado del día, prestado del día, clientes visitados, clientes sin pago, hora de inicio/fin de jornada) incluyendo un mapa con la ubicación de clientes y el trayecto recorrido por el cobrador, para supervisar la operación de campo en tiempo real.
- **HU-19.** Como Administrador o Socio, quiero consultar quién pagó y quién no pagó tanto en un día específico como en la semana completa, con acceso directo a WhatsApp del cliente moroso, para priorizar acciones de cobranza.

### Épica 4 — Reportes y liquidaciones

Basado en: generación de reporte semanal, historial de liquidaciones, exportación a Excel.

- **HU-20.** Como Administrador o Socio con permiso, quiero generar la liquidación semanal de una ruta, visualizando caja anterior, caja actual, estimado a cobrar, inyecciones, total cobrado (semana/día), total prestado, gastos acumulados, suma de cartera y comisión calculada automáticamente sobre el % configurado, para cerrar el ciclo semanal de forma auditable.
- **HU-21.** Como Administrador o Socio, quiero agregar un comentario libre a cada liquidación generada, para dejar constancia de observaciones relevantes del periodo.
- **HU-22.** Como Administrador o Socio, quiero consultar el historial completo de liquidaciones anteriores de una ruta y exportar cualquiera de ellas a Excel, para fines contables y de auditoría externa.

### Épica 5 — Panel administrativo (mejorado)

- **HU-23.** Como Administrador, quiero un dashboard consolidado multi-ruta y multi-socio con indicadores clave (cartera activa, mora total, cobrado del día/semana, gastos, comisiones), para tener visión ejecutiva del negocio sin entrar ruta por ruta.
- **HU-24.** Como Administrador, quiero un panel de monitoreo en vivo de las conversaciones del asistente de IA (activas, derivadas a humano, resueltas), para supervisar la calidad de la gestión conversacional automatizada.
- **HU-25.** Como Administrador, quiero configurar los límites financieros y reglas de negociación que el asistente de IA puede ofrecer autónomamente (ej. máximo de días de prórroga, mínimo de abono aceptable, número de reprogramaciones permitidas por cliente), para que la IA opere sin exceder el apetito de riesgo del negocio.
- **HU-26.** Como Administrador, quiero recibir alertas cuando el asistente de IA detecte un caso que requiera intervención humana (queja, disputa, solicitud explícita de agente, fraude sospechado), para reaccionar oportunamente.

### Épica 6 — Asistente de IA de Cobranza por WhatsApp (diferenciador exclusivo)

- **HU-27.** Como Cliente (prestatario), quiero poder preguntar por WhatsApp mi saldo actual, próxima cuota y fecha de vencimiento, para conocer mi estado de cuenta sin depender del cobrador.
- **HU-28.** Como Cliente, quiero poder registrar una promesa de pago conversando en lenguaje natural con el asistente (ej. "pago el viernes"), para formalizar mi compromiso sin necesidad de llamada telefónica.
- **HU-29.** Como Cliente, quiero poder negociar un plan de refinanciación o un abono parcial directamente con el asistente, para resolver situaciones de mora sin esperar disponibilidad de un cobrador humano.
- **HU-30.** Como sistema (Asistente IA), quiero enviar recordatorios proactivos antes del vencimiento de una cuota y alertas automáticas de mora según el estado de cuenta, para reducir el atraso sin intervención manual del cobrador.
- **HU-31.** Como sistema (Asistente IA), quiero evaluar cada solicitud de negociación contra las reglas y límites financieros configurados por el Administrador (HU-25) antes de confirmar cualquier acuerdo, para evitar comprometer condiciones fuera del apetito de riesgo del negocio.
- **HU-32.** Como sistema (Asistente IA), quiero detectar automáticamente cuándo un cliente solicita atención personalizada o cuándo el caso es demasiado complejo (disputa del monto, queja, lenguaje agresivo, fraude sospechado), y derivar la conversación al panel administrativo asignándola a un agente humano, para no forzar una automatización donde no corresponde.
- **HU-33.** Como Agente humano (Socio/Cobrador/Administrador), quiero recibir en el panel administrativo el historial completo de la conversación antes de tomar el caso derivado por la IA, para continuar la gestión con contexto completo.
- **HU-34.** Como Administrador, quiero que toda promesa de pago o acuerdo de refinanciación generado por la IA quede registrado como una entidad auditable vinculada al préstamo del cliente, para que impacte los reportes de cartera y liquidaciones.

### Épica 7 — Optimización de Rutas Inteligente

- **HU-35.** Como Cobrador, quiero recibir al inicio de la jornada la ruta óptima calculada automáticamente en base a la geolocalización de los clientes con pago pendiente ese día, para minimizar tiempo y costo de traslado.
- **HU-36.** Como sistema, quiero recalcular dinámicamente el orden de visitas si un cliente informa por WhatsApp que no estará disponible, o si se detecta un pago digital anticipado, para mantener la ruta siempre optimizada durante el día.
- **HU-37.** Como Cobrador, quiero recibir un enlace de navegación (Google Maps o Waze) con el orden estricto de la ruta calculada, para seguir el trayecto sin necesidad de planificar manualmente.
- **HU-38.** Como Administrador, quiero visualizar en el panel el trayecto planificado versus el trayecto realmente recorrido por el cobrador, para auditar el cumplimiento de la ruta asignada.
- **HU-44 (OPCIONAL).** Como Administrador y Socio, quiero poder ingresar al panel y ver en tiempo real la ubicación actual del cobrador durante su jornada, para hacer seguimiento en vivo del cumplimiento de la ruta del día.
  - **Estado:** Opcional / condicionado. No se compromete a desarrollo hasta tener claridad del costo que implica (tracking GPS continuo, frecuencia de actualización, consumo de batería/datos del cobrador, y costo de infraestructura de mensajería en tiempo real — ej. WebSockets/MQTT y almacenamiento de posiciones históricas).
  - **Diferencia con HU-38:** HU-38 es un análisis posterior (planificado vs. recorrido, con datos ya cerrados del día); HU-44 es una vista **en vivo** mientras el cobrador está en campo, lo cual exige una arquitectura distinta (conexión persistente o polling frecuente desde la APK) y por tanto un costo operativo adicional a evaluar aparte de HU-38.
  - **Antes de ejecutar esta historia** se debe entregar una estimación de costo (infraestructura de tiempo real + impacto en batería/datos del cobrador) y decidir explícitamente si se prioriza para el MVP o se deja para una fase posterior (ver sección 6).

### Épica 8 — Protocolo de Seguridad y Control de Dispositivos

- **HU-39.** Como Administrador, quiero vincular obligatoriamente el número de WhatsApp autorizado de cada cobrador con el IMEI de su dispositivo móvil, para restringir el acceso a la información de rutas a un único dispositivo autorizado.
- **HU-40.** Como sistema, quiero cifrar la ruta e itinerario del día y liberarlos únicamente después de validar que la solicitud proviene del dispositivo con el IMEI registrado, para evitar fugas de información sensible de cartera y clientes.
- **HU-41.** Como sistema, quiero registrar marca de tiempo y coordenadas geográficas cada vez que un cobrador abre la ruta del día en su dispositivo, para mantener un registro de auditoría de cumplimiento.
- **HU-42.** Como Administrador, quiero recibir una alerta cuando se detecte un intento de acceso a una ruta desde un dispositivo o número no autorizado (IMEI o WhatsApp no coincidente), para reaccionar ante un posible intento de fuga o suplantación.
- **HU-43.** Como Administrador, quiero poder re-vincular el IMEI autorizado de un cobrador (ej. por cambio de equipo) mediante un proceso de verificación, para no bloquear permanentemente a un cobrador legítimo que cambió de dispositivo.

---

## 3. Requerimientos no funcionales

### 3.1 Tecnologías sugeridas

| Componente | Propuesta | Justificación |
|---|---|---|
| Backend / API | Node.js (NestJS) o Python (FastAPI) | Tipado fuerte, ecosistema maduro para integraciones (WhatsApp, mapas, pagos), buen soporte async para IO-bound (mensajería) |
| Base de datos transaccional | PostgreSQL (con PostGIS) | Soporta relaciones jerárquicas complejas (Socio→Cobrador→Ruta→Cliente), extensión geoespacial nativa para rutas/geolocalización |
| Caché / colas en memoria | Redis | Sesiones, rate limiting del bot, colas ligeras, deduplicación de mensajes de WhatsApp |
| Cola de mensajería / eventos | RabbitMQ o AWS SQS/SNS | Procesamiento asíncrono de mensajes de WhatsApp, reintentos, desacoplar IA del flujo transaccional |
| Mensajería WhatsApp | WhatsApp Business Platform (Meta Cloud API) o proveedor BSP (Twilio, 360dialog) | Canal exclusivo definido en el requerimiento; Cloud API oficial reduce riesgo de bloqueo de número |
| Orquestación del asistente de IA | Framework de agentes (LangGraph, o implementación propia sobre Claude con function calling) + motor de reglas de negocio desacoplado | Separa "razonamiento conversacional" (LLM) de "decisión financiera" (reglas deterministas) — ver 3.3 |
| Modelo LLM primario | Anthropic Claude (familia Sonnet) vía API | Conversación natural en español, buen manejo de instrucciones extensas de negociación y objeciones (ver 3.3) |
| Modelo LLM secundario / clasificación | Modelo más pequeño/económico (ej. Claude Haiku) | Clasificación de intención, detección de derivación a humano, moderación rápida y de bajo costo |
| Mapas y rutas | Google Maps Platform (Directions API, Distance Matrix API) o alternativa OSRM/Mapbox self-hosted | Cálculo de ruta más corta, generación de enlaces de navegación (HU-37) |
| App móvil del cobrador (APK) | React Native o Flutter | Multiplataforma (hoy solo Android en Smart 369; se requiere abrir a iOS a futuro), acceso a GPS, cámara (reconocimiento facial) e identificadores de dispositivo |
| Panel administrativo web | React / Next.js | SPA/SSR para dashboards, tablas de permisos y monitoreo de conversaciones en vivo |
| Almacenamiento de archivos | S3 o equivalente | Fotos de reconocimiento facial, exportes de Excel, comprobantes |
| Infraestructura | Contenedores (Docker) + orquestador (Kubernetes o ECS) | Escalado independiente del servicio de IA/mensajería vs. API transaccional |

### 3.2 Seguridad

- **Autenticación y autorización**: JWT de corta duración + refresh tokens; RBAC granular replicando y extendiendo la matriz de permisos observada en Smart 369 (permisos por Socio a nivel plataforma, configuración por Ruta a nivel APK).
- **Vinculación dispositivo–identidad (HU-39 a HU-43)**: registro y validación de IMEI junto al número de WhatsApp autorizado; toda solicitud de itinerario debe pasar por una validación de "dispositivo conocido" antes de descifrar la ruta del día.
- **Cifrado**: TLS 1.2+ en tránsito; cifrado en reposo (AES-256) para tablas con datos de clientes, préstamos y credenciales; la ruta/itinerario diario se almacena y transmite cifrada, descifrándose únicamente en el dispositivo validado (HU-40).
- **Gestión de secretos**: uso de un vault (AWS Secrets Manager / HashiCorp Vault) para credenciales de terceros (WhatsApp, mapas, LLM); nunca en variables de entorno planas en producción.
- **Contraseñas**: hash con bcrypt/argon2; el administrador puede resetear pero nunca visualizar contraseñas (regla heredada de Smart 369, HU-04).
- **Protección del asistente de IA**: 
  - Sanitización de entradas para mitigar *prompt injection* desde WhatsApp.
  - Ninguna decisión financiera (aprobar refinanciación, condonar mora, etc.) se ejecuta directamente por salida del LLM: toda negociación pasa por un motor de reglas deterministas que valida contra los límites configurados (HU-31) antes de persistir el acuerdo.
  - Registro íntegro de cada conversación como evidencia auditable (no editable retroactivamente).
- **Cumplimiento normativo**: tratamiento de datos personales y financieros conforme a normativa de protección de datos aplicable en cada país donde opere el producto (dado que Smart 369 ya opera multi-país: Bolivia, México, Perú, Colombia, Argentina).
- **Auditoría de accesos**: registro de todo inicio de sesión, cambio de permisos, bloqueo/activación de socios/cobradores y apertura de rutas (timestamp + geolocalización, HU-41).

### 3.3 Modelos LLM y diseño del asistente de IA

- **Modelo conversacional principal**: Claude (familia Sonnet) para la interacción natural con el cliente por WhatsApp — manejo de objeciones, tono empático pero firme, comprensión de contexto de mora.
- **Modelo de clasificación/enrutamiento**: modelo más liviano (Claude Haiku o similar) para tareas de bajo costo/alta frecuencia: detectar intención (consulta de saldo, promesa de pago, queja, solicitud de agente humano), y decidir si el caso debe derivarse (HU-32).
- **Patrón arquitectónico recomendado — "IA propone, reglas deciden"**:
  1. El LLM interpreta el mensaje del cliente y genera una propuesta de acción (ej. "aceptar prórroga de 5 días").
  2. Un motor de reglas de negocio (código determinista, no LLM) valida la propuesta contra los límites configurados por el Administrador (HU-25/HU-31).
  3. Solo si la propuesta pasa la validación se ejecuta y persiste; en caso contrario, el asistente informa al cliente que el caso será revisado por un agente humano.
- **RAG (Retrieval-Augmented Generation)**: opcional, para que el asistente consulte políticas de cobranza, catálogo de métodos de pago vigentes y FAQs sin necesidad de reentrenar o hardcodear.
- **Guardrails**: capa de moderación de contenido antes y después de cada respuesta del LLM (evitar lenguaje amenazante, discriminatorio o promesas no autorizadas).
- **Costos**: uso del modelo liviano para el 80% del tráfico (clasificación/FAQ) y reserva del modelo Sonnet para negociación y objeciones complejas, optimizando costo por conversación.

### 3.4 Observabilidad

- **Logging estructurado** (JSON) centralizado (ej. ELK / OpenSearch), con correlación por `conversation_id`, `route_id` y `tenant_id`.
- **Tracing distribuido** (OpenTelemetry) para seguir una solicitud desde WhatsApp → orquestador IA → motor de reglas → base de datos.
- **Métricas de negocio y técnicas** (Prometheus/Grafana): tasa de derivación a humano, tasa de promesas de pago cumplidas, latencia de respuesta del asistente, tasa de error de validación de IMEI, tiempo promedio de ruta recalculada.
- **Monitoreo específico de IA**: costo por conversación, tasa de alucinación detectada (vía revisión de muestreo), tasa de acuerdos rechazados por el motor de reglas, feedback humano post-derivación.
- **Alertas**: umbral de mora súbita, fallos de integración con WhatsApp/Mapas/LLM, accesos con IMEI no reconocido (HU-42), caídas de disponibilidad del bot.

### 3.5 No funcionales generales

- **Multi-tenancy**: aislamiento lógico por `tenant_id` desde el diseño de base de datos (empresa prestamista → sus socios/rutas/clientes).
- **Multi-moneda / multi-país**: parametrización de moneda e interés por ruta (ya observado en Smart 369).
- **Disponibilidad**: objetivo 99.5% para el canal de WhatsApp del asistente (es el canal exclusivo de cobranza automatizada, su caída afecta directamente la operación).
- **Escalabilidad**: arquitectura desacoplada para picos de mensajería (ej. día de vencimiento masivo de cuotas).
- **Internacionalización (i18n)**: soporte de español como idioma base, con estructura preparada para otros idiomas.

---

## 4. Propuesta de arquitectura de base de datos preliminar

### 4.1 Diagrama entidad-relación (simplificado)

```mermaid
erDiagram
    TENANT ||--o{ SOCIO : tiene
    TENANT ||--o{ ADMIN_USER : tiene
    SOCIO ||--o{ COBRADOR : administra
    SOCIO ||--o{ RUTA : posee
    SOCIO }o--|| SOCIO_PERMISOS : tiene
    COBRADOR ||--o{ RUTA : opera
    COBRADOR ||--|| DEVICE : vinculado_a
    RUTA ||--|| RUTA_CONFIG : configurada_por
    RUTA ||--o{ CLIENTE : gestiona
    RUTA ||--o{ GASTO : registra
    RUTA ||--o{ INYECCION : recibe
    RUTA ||--o{ LIQUIDACION : genera
    CLIENTE ||--o{ PRESTAMO : solicita
    PRESTAMO ||--o{ CUOTA : compuesto_de
    CUOTA ||--o{ PAGO : recibe
    PRESTAMO ||--o{ ABONO : recibe
    CLIENTE ||--o{ CONVERSACION_IA : participa
    CONVERSACION_IA ||--o{ MENSAJE_IA : contiene
    CONVERSACION_IA ||--o{ PROMESA_PAGO : genera
    PROMESA_PAGO }o--|| PRESTAMO : vinculada_a
    RUTA ||--o{ RUTA_OPTIMIZADA_LOG : calcula
    DEVICE ||--o{ ACCESO_RUTA_LOG : audita
    ADMIN_USER ||--o{ REGLA_NEGOCIACION_IA : configura
```

### 4.2 Tablas principales y atributos

**tenants**
`id (PK), nombre, pais, moneda_default, estado, created_at`

**admin_users**
`id (PK), tenant_id (FK), usuario, password_hash, nombre, apellido, correo, telefono, estado, created_at`

**socios**
`id (PK), tenant_id (FK), usuario, password_hash, nombre, apellido, correo, telefono, codigo, moneda, estatus (activo/bloqueado), created_at`

**socio_permisos**
`id (PK), socio_id (FK), permiso (enum: borrar_clientes, eliminar_rutas, actualizar_cliente, eliminar_prestamos, borrar_ultima_cuota, configurar_ruta, eliminar_abono, eliminar_inyeccion, generar_reporte, ver_reportes, descargar_reporte, bloquear_cobradores, eliminar_gastos, registrar_socio, bloquear_socio, editar_permisos, modificar_cupo, eliminar_socio, registrar_cobrador, registrar_ruta), habilitado (bool)`

**cobradores**
`id (PK), socio_id (FK), usuario, password_hash, nombre, apellido, correo, telefono, codigo, estatus (activo/bloqueado), created_at`

**devices**
`id (PK), cobrador_id (FK), imei, whatsapp_number, estado (activo/revocado/pendiente_revalidacion), fecha_vinculacion`

**acceso_ruta_log**
`id (PK), device_id (FK), ruta_id (FK), timestamp, latitud, longitud, resultado (autorizado/denegado)`

**rutas**
`id (PK), socio_id (FK), cobrador_id (FK), nombre, descripcion, tipo_interes (%), num_cuotas, moneda, estatus, created_at`

**ruta_config**
`id (PK), ruta_id (FK, unique), cuotas_minimas_prestamo, cuotas_atraso_umbral, manejo_cupo_activo (bool), cupo_default, recargo_activo (bool), bloquear_cambio_interes (bool), comision_activa (bool), comision_porcentaje, mostrar_fecha_ultima_liquidada (bool), mostrar_caja (bool), mostrar_cobrado_liquidada (bool), mostrar_prestamos (bool), eliminar_prestamos_apk (bool), reconocimiento_facial_activo (bool), eliminar_pagos_apk (bool), eliminar_gastos_apk (bool), eliminar_inyeccion_apk (bool), eliminar_abonos_apk (bool), registrar_inyeccion_apk (bool), generar_reportes_apk (bool), ocultar_cartera (bool), mostrar_cobro_estimado (bool), bloqueo_automatico_clientes (bool), permitir_cambio_fecha_prestamo (bool), borrar_clientes_sin_deuda (bool)`

**clientes**
`id (PK), ruta_id (FK), nombre, apellido, negocio, telefono_whatsapp, latitud, longitud, estatus (activo/bloqueado), color_riesgo (azul/rojo/blanco), created_at`

**prestamos**
`id (PK), cliente_id (FK), ruta_id (FK), valor, num_cuotas, fecha_otorgado, latitud, longitud, estatus (vigente/liquidado/cancelado)`

**cuotas**
`id (PK), prestamo_id (FK), numero_cuota, valor_esperado, fecha_vencimiento, estatus (pendiente/pagada/atrasada)`

**pagos**
`id (PK), cuota_id (FK), cliente_id (FK), valor, fecha_hora, registrado_por (cobrador_id o ia)`

**abonos**
`id (PK), prestamo_id (FK), cliente_id (FK), valor, fecha_hora, registrado_por`

**gastos**
`id (PK), ruta_id (FK), descripcion, valor, creado_por (cobrador_id, nullable = "no definido"), aprobado (bool), fecha_hora`

**inyecciones**
`id (PK), ruta_id (FK), valor, comentario, fecha_hora, estado (activa/eliminada)`

**liquidaciones**
`id (PK), ruta_id (FK), fecha, caja_anterior, caja_actual, estimado_a_cobrar, total_inyeccion, total_cobrado_semana, total_cobrado_dia, total_prestado, total_gastos, suma_cartera, comision_porcentaje, comision_valor, comentario, created_at`

**conversaciones_ia**
`id (PK), cliente_id (FK), canal (whatsapp), estado (activa/derivada/resuelta), motivo_derivacion (nullable), agente_asignado_id (nullable), created_at, closed_at`

**mensajes_ia**
`id (PK), conversacion_id (FK), emisor (cliente/ia/agente), contenido, intencion_detectada, modelo_usado, timestamp`

**promesas_pago**
`id (PK), conversacion_id (FK), prestamo_id (FK), fecha_prometida, valor_prometido, estado (pendiente/cumplida/incumplida), creado_por (ia/agente)`

**reglas_negociacion_ia**
`id (PK), tenant_id (FK), configurado_por (admin_user_id), max_dias_prorroga, min_abono_aceptable_pct, max_reprogramaciones_por_cliente, vigente_desde`

**ruta_optimizada_log**
`id (PK), ruta_id (FK), fecha, orden_clientes_json, distancia_estimada_km, tiempo_estimado_min, recalculado (bool), motivo_recalculo (nullable)`

### 4.3 Notas de diseño

- **Multi-tenancy**: todas las tablas raíz cuelgan de `tenant_id` (directa o indirectamente vía `socio_id`/`ruta_id`) para permitir aislamiento por prestamista/empresa.
- **Separación de permisos en dos niveles**: `socio_permisos` (plataforma web) y `ruta_config` (comportamiento APK del cobrador) se modelan como tablas independientes, replicando la distinción observada en Smart 369.
- **Trazabilidad financiera**: `gastos`, `inyecciones` y `liquidaciones` mantienen snapshots inmutables una vez generados (solo `estado = eliminada` cambia visibilidad, no se borra físicamente el registro), preservando auditoría histórica.
- **IA desacoplada de la cartera**: `conversaciones_ia`, `mensajes_ia` y `promesas_pago` son tablas independientes que solo impactan `prestamos`/`cuotas` a través de un proceso de confirmación (motor de reglas), nunca de forma directa desde el LLM.
- **Seguridad de dispositivos**: `devices` y `acceso_ruta_log` habilitan la validación IMEI + WhatsApp y la auditoría geolocalizada exigida en la Épica 8.
- **Geolocalización**: se recomienda usar tipo `geography(Point)` de PostGIS en lugar de `latitud/longitud` planos para habilitar cálculos de distancia y las consultas de optimización de ruta de forma nativa en base de datos.

---

## 5. Trazabilidad (resumen)

| Origen | Épica(s) cubierta(s) |
|---|---|
| Videos Smart 369 (18 transcripciones) | Épicas 1 a 5 |
| Asistente de IA de Cobranza (WhatsApp) | Épica 6 |
| Optimización de Rutas Inteligente | Épica 7 |
| Protocolo de Seguridad y Control de Dispositivos | Épica 8 |

---

## 6. Estrategia de implementación: MVP local antes de producción

**Principio rector:** no se debe pasar a producción (ni incurrir en costos variables de WhatsApp Business API, LLM o infraestructura de tiempo real) sin haber validado primero el flujo funcional completo en un entorno local/de pruebas. El objetivo del MVP es desarrollar la mayor cantidad posible de los requerimientos de este documento de forma que puedan ejecutarse y probarse en local, difiriendo para una fase posterior únicamente lo que depende intrínsecamente de servicios externos de producción (números de WhatsApp reales, dispositivos físicos con IMEI, tracking GPS continuo en campo).

### 6.1 Fases propuestas

| Fase | Entorno | Qué se puede construir y probar | Qué se difiere |
|---|---|---|---|
| **Fase 1 — MVP local** | Docker Compose local (Postgres+PostGIS, Redis, backend, panel admin) | Épicas 1 a 5 completas (roles, permisos, rutas, cartera, préstamos, pagos, gastos, inyecciones, reportes, liquidaciones, dashboard); Épica 7 con datos simulados (cálculo de ruta óptima sobre coordenadas de prueba, sin GPS real); Épica 6 con un simulador de conversación (chat de pruebas o WhatsApp Sandbox de Meta con números de test, sin costo); Épica 8 con IMEI/WhatsApp simulados (mock de validación de dispositivo) | WhatsApp Business API en producción (número real verificado), tracking GPS en vivo (HU-44), IMEI real de dispositivos físicos, volumen real de LLM |
| **Fase 2 — Piloto controlado** | Entorno de pruebas/staging con 1-2 rutas reales | Activar WhatsApp Business API en modo pruebas/limitado con clientes reales voluntarios; activar LLM con límites de costo bajos; probar HU-39 a HU-43 con dispositivos físicos reales de 1-2 cobradores | Tracking en tiempo real (HU-44) se mantiene fuera de alcance hasta tener el costo estimado (ver 6.2); escalado multi-tenant |
| **Fase 3 — Producción** | Infraestructura cloud completa (ver sección 3.1) | Todas las épicas a escala, multi-tenant, multi-ruta | — |

### 6.2 Requisito previo específico para HU-44 (ubicación en tiempo real)

Antes de decidir si HU-44 entra en la Fase 2 o se posterga:
1. Estimar el costo de infraestructura de tiempo real (conexión persistente vía WebSockets/MQTT o polling periódico, almacenamiento de histórico de posiciones).
2. Estimar el impacto en consumo de batería y datos móviles del cobrador (frecuencia de envío de ubicación).
3. Comparar ese costo contra el valor que aporta frente a HU-38 (que ya cubre auditoría de ruta recorrida vs. planificada, pero de forma posterior, no en vivo).
4. Solo si el costo es aceptable y el valor lo justifica, se prioriza HU-44 para desarrollo; de lo contrario, queda documentada como backlog futuro.

### 6.3 Beneficio de este enfoque

- Permite validar la lógica de negocio (jerarquía Socio→Cobrador→Ruta, permisos, cálculo de liquidaciones, reglas de negociación de la IA) sin gastar en APIs de terceros.
- Reduce el riesgo de invertir en infraestructura de producción (WhatsApp, LLM, tracking en tiempo real) antes de confirmar que el flujo funcional es correcto y que el modelo de costos (ver conversación de pricing) es sostenible.
- Facilita hacer pruebas de aceptación con datos ficticios antes de exponer datos reales de clientes/cartera.
