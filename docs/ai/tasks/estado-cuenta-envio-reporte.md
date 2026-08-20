# Tarea: Estado de cuenta del préstamo y envío del reporte por WhatsApp (HU-54)

- **Origen:** Roadmap Fase 4 ítem 26 (docs/plan-feature-roadmap.md:55) — HU-54 (docs/APP_REQUIREMENTS.md:97), amplía HU-27 (docs/APP_REQUIREMENTS.md:87).
- **Estado:** completada
- **Fecha inicio:** 2026-08-20

## Objetivo
Exponer el estado de cuenta de un préstamo (datos del préstamo, cuotas pagadas/restantes, abonos por cuota, saldos y próximo vencimiento, en recuadros por cuota) y permitir el envío manual del reporte al cliente por WhatsApp (gateway simulado), sobre la infraestructura de conversación de los ítems 23-25.

## Fuera de alcance
- Respuesta automática del asistente a la solicitud del cliente por WhatsApp (HU-27) — iteración del asistente IA.
- Canal WhatsApp Cloud API real (Fase 2).
- Exportación PDF/archivo del estado de cuenta (no requerido por HU-54).
- Envío programado/automático del reporte.

## Bloques (checklist TDD)
- [x] Bloque 1: Funciones puras de dominio — `construirEstadoCuentaPrestamo` (saldos/abonos acumulados por cuota, próximo vencimiento, totales) y `construirTextoReporte` (texto plano del mensaje). En `src/domain/estado-cuenta-prestamo.ts`.
  - Test(s): `src/domain/estado-cuenta-prestamo.spec.ts` (5 tests)
- [x] Bloque 2: `EstadoCuentaService` — `obtener` (GET estado-cuenta, gated ver_reportes) y `enviarReporte` (POST, gated generar_reporte, envía vía gateway con emisor `ia` e intención `reporte_estado_cuenta`). Reutiliza `NotificacionesService.obtenerConversacion`.
  - Test(s): `src/modules/cartera/estado-cuenta.service.spec.ts` (6 tests)
- [x] Bloque 3: Endpoints en `cartera.controller` — `GET /rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` y `POST /rutas/:rutaId/prestamos/:prestamoId/enviar-reporte` + registro en `cartera.module`.
  - Test(s): `src/modules/cartera/cartera.controller.spec.ts` (2 tests nuevos)
- [x] Bloque 4: e2e `test/e2e/estado-cuenta-envio-reporte.e2e-spec.ts` (5 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e` (con `--forceExit` por los crons).

## Decisiones tomadas durante la implementación
- Alcance: estado de cuenta + envío manual (respuesta a solicitud del cliente = HU-27, fuera).
- Abonos: **acumulados del préstamo + saldo pendiente por cuota** (prorrateo desde la primera cuota pendiente). El esquema actual no vincula abono→cuota (sin `cuota_id` en `abonos`), se documenta.
- Permisos: GET `ver_reportes` / POST `generar_reporte` (patrón de escritura del proyecto).
- URL: anidada bajo préstamo (`rutas/:rutaId/prestamos/:prestamoId/...`).
- Texto del reporte incluye la moneda de la ruta (asumido; el préstamo no guarda moneda propia).
- Envío manual: sin deduplicación por día (es explícito, no automático).

## Ambigüedades resueltas con el usuario
- Pregunta: alcance → **estado de cuenta + envío manual** (HU-27 difiere a IA).
- Pregunta: abonos por cuota → **abonos acumulados del préstamo + saldos por cuota**.
- Pregunta: permisos → **GET ver_reportes / POST generar_reporte**.
- Pregunta: URL → **anidada bajo préstamo**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK (488 tests, 59 suites).
  - `npm run test:e2e -- --forceExit` → 37 suites / 254 tests OK (incluye `estado-cuenta-envio-reporte.e2e-spec.ts`, 5 tests).
- Archivos modificados:
  - `src/domain/estado-cuenta-prestamo.ts` (+spec) — `construirEstadoCuentaPrestamo`, `construirTextoReporte`.
  - `src/modules/cartera/estado-cuenta.service.ts` (+spec) — `obtener`, `enviarReporte`.
  - `src/modules/cartera/cartera.controller.ts` (+spec) — `GET .../prestamos/:prestamoId/estado-cuenta` (ver_reportes) y `POST .../prestamos/:prestamoId/enviar-reporte` (generar_reporte).
  - `src/modules/cartera/cartera.module.ts` — registro de `EstadoCuentaService`.
  - `test/e2e/estado-cuenta-envio-reporte.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/estado-cuenta-envio-reporte.md` (este archivo).
- Decisiones de implementación:
  - El estado de cuenta por préstamo usa funciones puras de dominio; los abonos se imputan FIFO desde la primera cuota no pagada (esquema sin `cuota_id` en `abonos`).
  - `enviarReporte` reutiliza `NotificacionesService.obtenerConversacion` y envía vía gateway con emisor `ia` e `intencionDetectada: "reporte_estado_cuenta"` (persistido en `mensajes_ia`). Sin deduplicación por día (envío manual explícito).
  - Texto del reporte incluye la moneda de la ruta (el préstamo no guarda moneda propia).
- Revisión independiente (code-reviewer, 2026-08-20): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) `proximoVencimiento` ahora ignora cuotas pendientes totalmente cubiertas por abonos (saldo 0) + test; (b) el texto del reporte incluye ahora el saldo por cuota (HU-54 "saldos en recuadros por cuota"). Documentadas sin cambio: `abonosAcumulados` es acumulativo FIFO por cuota (decisión registrada); `enviarReporte` no valida estatus "vigente" (un préstamo liquidado/cancelado también puede consultarse, se deja); trabajo sin commit previo a la revisión (esperado: la revisión precede al commit/PR del DoD).
- Pendientes/seguimiento:
  - Respuesta automática del asistente a la solicitud del cliente por WhatsApp (HU-27) — iteración del asistente IA.
  - Canal WhatsApp Cloud API real (Fase 2).
  - Regla de prorrateo de abonos (FIFO) a validar con negocio antes de Fase 2 (semántica de saldo por cuota).
