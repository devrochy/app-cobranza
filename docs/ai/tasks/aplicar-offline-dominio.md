# Tarea: aplicar-offline-dominio (procesar eventos offline al dominio)

- **Origen:** Fase B del plan de la APK (offline-first) aprobado por el usuario 2026-09-01. Mecanismo A (Sync API + processor). El módulo `sincronizacion-offline` ya ingiere con dedup pero NO aplica al dominio.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-01

## Objetivo
Que los eventos `sincronizacion_offline` en estado `pendiente` se apliquen al dominio (visitas/pagos/abonos/gastos/promesas/cambios de cliente/trayectoria) reusando los servicios existentes, idempotente por `(device, evento_id_cliente)`, marcando `sincronizado` (aplicado) o `error` con motivo.

## Fuera de alcance
- Capa offline de la APK (repo app-cobranza-apk, tarea `apk-offline-first`).
- Vinculación IMEI/WhatsApp (Épica 8).

## Bloques (checklist TDD)
- [x] Bloque 1: `ingestir` guarda los eventos en estado `pendiente` (dedup y ack intactos).
  - Test(s): `src/modules/sincronizacion-offline/sincronizacion-offline.service.spec.ts`
- [x] Bloque 2: `AplicarEventosOfflineService.aplicarEventosDeDispositivo` + `aplicarPendientesDeDispositivo` — requester cobrador de la ruta del device; dispatch por tipo (visita/pago/abono/gasto/cambio_cliente); estados `sincronizado`/`error` con motivo; idempotente.
  - Test(s): `aplicar-eventos-offline.service.spec.ts` (7)
- [x] Bloque 3: `EvidenciasOfflineService` — base64 → disco (`UPLOAD_DIR`) + `ArchivoSubido`; mimetype y tope 5MB.
  - Test(s): `evidencias-offline.service.spec.ts` (3)
- [x] Bloque 4: aplicar on-ingest (controller `sincronizar`) + job `@Cron` de reintentos (`AplicarOfflineJob`).
  - Test(s): controller.spec (on-ingest), job (typecheck)
- [x] Bloque 5: wiring — `CarteraModule` exporta `AbonosService`; módulo importa `CarteraModule`; seed crea device vinculado a `test-cobrador-1` (codigo fijo + key conocida).
  - Test(s): seed spec
- [x] Bloque 6: e2e `aplicar-offline.e2e-spec.ts` — visita pago aplicada (cuota pagada), duplicado no re-aplica, gasto con evidencia base64, error con motivo. Suite e2e completa 367/367.

## Decisiones tomadas durante la implementación
- Estados: `pendiente` (aceptado) → `procesando` (claim) → `sincronizado` (aplicado) / `error` (columna nueva `error_motivo` + `reintentos` con tope de 5).
- Requester del procesador: `{ rol: "cobrador", sub: ruta.cobradorId }` (pasa `assertOwned`).
- `synchronize` activo en dev → las columnas se auto-crean (en producción hará falta migración — nota en backlog).
- Revisión code-reviewer: se aplicaron los fixes — **validación de forma por tipoEvento** (reusa los DTOs online con `plainToInstance`+`validate`; evita montos negativos en gasto/abono), **claim atómico** (`pendiente`/`error` → `procesando` con `WHERE` condicional) para evitar duplicados entre on-ingest y el cron, **chequeo de `cobrador_permisos`** por tipoEvento (visita→registrar_pago/registrar_no_pago según resultado), `promesa_pago` fuera del catálogo (se registra vía visita con compromiso_de_pago), límite de reintentos, doc comments actualizados, job con spec.
- El sync e2e se actualizó: con on-ingest, su evento `gasto` de prueba crea un gasto → su afterAll limpia gastos/evidencias; su assert de estado refleja el procesamiento.

## Ambigüedades resueltas con el usuario
- Mecanismo → A (Sync API + processor). Evidencias offline → base64. Provisioning → seed de device vinculado al cobrador.

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (lint + typecheck + unit) y `scripts/test-e2e.sh` verde (367 tests, 53 suites).
- Archivos modificados:
  - `src/modules/sincronizacion-offline/`: `sincronizacion-offline.entity.ts` (+`errorMotivo`), `sincronizacion-offline.service.ts` (estado `pendiente`), `aplicar-eventos-offline.service.ts` (nuevo, +spec), `evidencias-offline.service.ts` (nuevo, +spec), `aplicar-offline-job.service.ts` (nuevo), `sincronizacion-offline.controller.ts` (on-ingest), `sincronizacion-offline.module.ts` (wiring).
  - `src/modules/cartera/cartera.module.ts` — exporta `AbonosService`.
  - `src/modules/test-data/test-data.module.ts` + `test-data.seed.service.ts` — device de prueba vinculado a `test-cobrador-1`.
  - `test/e2e/aplicar-offline.e2e-spec.ts` (nuevo, 4), `test/e2e/sincronizacion-offline.e2e-spec.ts` (actualizado).
  - `docs/ai/tasks/aplicar-offline-dominio.md`.
- Pendientes/seguimiento: capa offline de la APK (`apk-offline-first`): cola local, device key en `.env.local`, sync automático y cache del día. La key del device de prueba: `00000000-0000-4000-8000-000000000001.test-device-secreto`.