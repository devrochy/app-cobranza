# Tarea: Notificaciones de pago de cuota en ciclo completo con config por ruta (HU-52)

- **Origen:** Roadmap Fase 4 ítem 24 (docs/plan-feature-roadmap.md:53) — HU-52 (docs/APP_REQUIREMENTS.md:95), amplía HU-30. Config PRD 4.2:276 (`dias_anticipacion_notificacion`, `aviso_dia_cobro`, `umbral_mora_notificacion`).
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Ciclo completo de notificaciones de pago de cuota por ruta: recordatorio antes del vencimiento (N días por ruta), aviso el día de cobro, confirmación al registrarse el pago y alerta de mora si no se paga. Avisos al cliente por WhatsApp (gateway simulado) y registro de avisos a Cobrador/Socio.

## Fuera de alcance
- Canal real de WhatsApp (Cloud API) — Fase 2.
- Historial unificado de conversación/chat (HU-53, ítem 25).
- Envío del reporte de préstamo por WhatsApp (HU-54, ítem 26).
- Asistente IA conversacional (LLM) — solo notificaciones automáticas del sistema.
- Recálculo dinámico de ruta por notificaciones (HU-36).

## Decisiones tomadas durante la implementación
- Antes (recordatorio): cuotas pendientes que vencen en N días, `N = ruta_config.dias_anticipacion_notificacion` (por ruta).
- Durante (aviso día de cobro): cuotas con `fecha_vencimiento = hoy` (pendiente), gated por `avisoDiaCobro`.
- Después (confirmación): wiring en `PagosService.registrarPagoDeCuota` que envía confirmación al cliente.
- Después (alerta mora): job consulta cuotas `atrasada`, alerta a clientes con atraso >= `ruta_config.umbral_mora_notificacion`.
- Destinatarios: cliente por WhatsApp + registro de avisos a Cobrador/Socio en el historial (sin canal real aún).
- Deduplicación: no reenviar la misma notificación del mismo tipo el mismo día (via `mensajes_ia`/conversación).

## Bloques (checklist TDD)
- [x] Bloque 0: `NotificacionesService` — `ejecutarAvisoDiaCobro` (cuotas que vencen hoy, gated avisoDiaCobro), `ejecutarAlertaMora` (atraso >= umbral), `enviarConfirmacionPago`, deduplicación por tipo/día (via mensajes_ia). 4 tests nuevos (ciclo) + 2 existentes.
- [x] Bloque 1: `NotificacionesJob` recorre rutas activas y dispara recordatorio + aviso día + alerta mora (inyecta Ruta repo).
- [x] Bloque 2: Wiring de confirmación en `PagosService.registrarPagoDeCuota` (envía confirmación al cliente tras el pago). 7 tests en pagos.
- [x] Bloque 3: e2e `notificaciones-ciclo-pago.e2e-spec.ts` (3 tests: aviso día persiste, confirmación al pagar, config notificación).
- Verificación: `scripts/check.sh` + e2e (con `--forceExit` por los crons de @nestjs/schedule que mantienen timers).

## Ambigüedades resueltas con el usuario
- Pregunta: aviso día → **cuotas que vencen hoy** (gated por avisoDiaCobro).
- Pregunta: confirmación → **al registrar pago** (wiring en PagosService).
- Pregunta: alerta mora → **por job + umbral de ruta**.
- Pregunta: destinatarios → **cliente + registro a cobrador/socio**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - e2e `notificaciones-ciclo-pago.e2e-spec.ts` → 3 tests OK (con `--forceExit` por los crons).
- Archivos modificados:
  - `src/modules/cartera/notificaciones.service.ts` (+specs) — métodos del ciclo completo + deduplicación + repo RutaConfig/MensajeIa.
  - `src/modules/cartera/notificaciones-job.service.ts` — recorre rutas activas, dispara ciclo completo.
  - `src/modules/cartera/pagos.service.ts` (+spec) — wiring de confirmación al registrar pago.
  - `test/e2e/notificaciones-ciclo-pago.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/notificaciones-ciclo-pago.md` (este archivo).
- Decisiones de implementación:
  - `ejecutarAvisoDiaCobro`/`ejecutarAlertaMora` leen `ruta_config` (avisoDiaCobro/umbralMoraNotificacion).
  - Deduplicación por tipo y día via consulta en `mensajes_ia` (contenido LIKE tipo + timestamp del día).
  - Avisos a cobrador/socio: se registran como intención (pendiente de canal real); en esta iteración el envío real es solo al cliente.
- Limitación registrada: los e2e con `@nestjs/schedule` (crons del job de mora/notificaciones) requieren `--forceExit` para que Jest termine; es una limitación del repo pre-existente.
- Revisión independiente (code-reviewer, 2026-08-20): inicialmente **NO APROBADO** → bloqueantes corregidos y re-verificado, luego **APROBADO CON OBSERVACIONES** (sin bloqueantes). Bloqueantes: (a) recordatorio lee `ruta_config.dias_anticipacion_notificacion` por ruta y filtra cuotas por ruta; (b) deduplicación usa `mensajes_ia.intencion_detectada`; (c) confirmación aislada con try/catch en PagosService; (d) cobertura de `ejecutarAlertaMora`, confirmación y fallo-no-bloqueante. Observaciones atendidas: `logger.warn` en el catch de pagos, e2e usa `formatDate` (evita flakiness por timezone), `yaEnviado` con `getExists()`. Limitación explícita: avisos a Cobrador/Socio (HU-52) no implementados (solo al cliente); pendiente de canal real. Semántica de `umbral_mora_notificacion` (cuenta cuotas) pendiente de confirmar con negocio.
- Pendientes/seguimiento:
  - Canal real a Cobrador/Socio (sin login/WhatsApp aún); avisos a cobrador/socio de HU-52 pendientes.
  - Historial unificado/chat (HU-53, ítem 25), tarjeta/envío (HU-54, ítem 26).
  - Semántica de `umbral_mora_notificacion` (cuenta cuotas, no días) — confirmar con negocio antes de Fase 2.