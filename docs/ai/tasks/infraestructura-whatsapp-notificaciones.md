# Tarea: Infraestructura del simulador de WhatsApp y motor de notificaciones (Ítem 23)

- **Origen:** Roadmap Fase 4 ítem 23 (docs/plan-feature-roadmap.md:52) — prerrequisito para HUs de conversación (HU-52/53/54) y recálculo (HU-36). PRD Fase 1 6.1 (simulador sin costo).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Infraestructura base de mensajería: abstracción de gateway de WhatsApp con implementación simulada local, motor de programación de notificaciones (job diario), entidades `conversaciones_ia`/`mensajes_ia` y config de notificación por ruta.

## Fuera de alcance
- WhatsApp Cloud API real funcional (solo esqueleto/placeholder; integración real es Fase 2).
- LLM/IA conversacional (orquestación de agentes).
- HUs específicas: HU-52 (ciclo completo), HU-53 (historial/chat), HU-54 (tarjeta/envío) — ítems 24-26.
- Promesas de pago por IA / negociación (HU-27-34).
- Historial de conversaciones de socio (HU-63, Fase 5).

## Decisiones tomadas durante la implementación
- Simulador: abstracción `WhatsappGateway` + implementación `WhatsappSimuladoGateway` local (webhook simulado + persistencia en `mensajes_ia`), conmutable a Cloud API real por config/env.
- Motor: job diario `@nestjs/schedule` (ya integrado) + `NotificacionesService` + persistencia para deduplicación.
- Entidades `ConversacionIa`/`MensajeIa` (PRD 4.2:331-335).
- Config de notificación por ruta: agregar `dias_anticipacion_notificacion`, `aviso_dia_cobro`, `umbral_mora_notificacion` a `ruta_config` (PRD 4.2:276).

## Bloques (checklist TDD)
- [x] Bloque 0: Abstracción `WhatsappGateway` (interfaz + token) + `WhatsappSimuladoGateway` (persiste en mensajes_ia). 2 tests.
- [x] Bloque 1: Entidades `ConversacionIa`/`MensajeIa` (PRD 4.2:331-335) + registro en módulo + `WHATSAPP_GATEWAY` (useExisting simulador).
- [x] Bloque 2: `NotificacionesService` (recordatorios pre-vencimiento, crea conversación) + `NotificacionesJob` (@Cron diario). 2 tests unitarios.
- [x] Bloque 3: Campos de notificación en `ruta_config` (`dias_anticipacion_notificacion`, `aviso_dia_cobro`, `umbral_mora_notificacion`) + defaults + DTO matriz.
- [x] Bloque 4: `WhatsappSimuladoController` (`POST /whatsapp/simulado/recibir`) + e2e (2 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: simulador → **abstracción + implementación simulada local**.
- Pregunta: motor → **job diario + servicio de agenda + persistencia**.
- Pregunta: persistencia → **crear conversaciones_ia/mensajes_ia**.
- Pregunta: config → **agregar flags de notificación a ruta_config**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `infraestructura-whatsapp-notificaciones.e2e-spec.ts`, 2 tests).
- Archivos modificados:
  - `src/modules/cartera/whatsapp-gateway.interface.ts` (nuevo) — interfaz + token `WHATSAPP_GATEWAY`.
  - `src/modules/cartera/whatsapp-simulado.gateway.ts` (+spec) — `enviarMensaje`/`recibirMensaje` persisten en `mensajes_ia`.
  - `src/modules/cartera/whatsapp-simulado.controller.ts` (nuevo) — `POST /whatsapp/simulado/recibir`.
  - `src/modules/cartera/conversacion-ia.entity.ts`, `mensaje-ia.entity.ts` (nuevos) — PRD 4.2:331-335.
  - `src/modules/cartera/notificaciones.service.ts` (+spec) — `ejecutarRecordatorios`.
  - `src/modules/cartera/notificaciones-job.service.ts` (nuevo) — `@Cron("0 30 7 * * *")`, `diasAnticipacion: 3` default (wiring por ruta en HU-52).
  - `src/modules/cartera/cartera.module.ts` — entidades, gateway (WHATSAPP_GATEWAY), servicios, controller.
  - `src/modules/rutas/ruta-config.entity.ts`, `ruta-config.service.ts`, `dto/update-ruta-config-matrix.dto.ts` — campos de notificación.
  - `test/e2e/infraestructura-whatsapp-notificaciones.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/infraestructura-whatsapp-notificaciones.md` (este archivo).
- Decisiones de implementación:
  - `diasAnticipacion` del job en 3 por ahora; el wiring por ruta (desde `ruta_config.dias_anticipacion_notificacion`) se completa en HU-52.
  - El endpoint webhook simulado requiere token JWT (JwtAuthGuard) — no expuesto públicamente.
- Revisión independiente (code-reviewer, 2026-08-19): inicialmente **RECHAZADO** → corregido y re-verificado. Bloqueante: (a) el webhook simulado no tenía `@UseGuards(JwtAuthGuard)` (endpoint público) → se agregó el guard + test e2e de 401 sin token. Observaciones atendidas: (b) limpieza e2e filtrada por nombre de ruta (evita interferencia entre specs); (c) `RecibirMensajeDto` convertido a clase con `@IsInt`/`@IsString`/`@IsNotEmpty` (validación real). Nits documentados: deduplicación pendiente (HU-52), test "deduplica" sin cobertura (renombrado), zona horaria del job, `telefono` ignorado por el simulador.
- Pendientes/seguimiento:
  - WhatsApp Cloud API real funcional (Fase 2) — `WhatsappCloudApiGateway` placeholder.
  - HU-52 (ciclo completo con config por ruta), HU-53 (historial/chat), HU-54 (tarjeta/envío) — ítems 24-26.
  - Deduplicación robusta de notificaciones por día (completar en HU-52).
  - Orquestación de IA conversacional (Épica 6).