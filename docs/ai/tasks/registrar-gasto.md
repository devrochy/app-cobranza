# Tarea: Registrar y aprobar gastos de ruta con evidencias (HU-17)

- **Origen:** Roadmap Fase 1 ítem 9 (docs/plan-feature-roadmap.md:27) — HU-17 (docs/APP_REQUIREMENTS.md:60). Tablas PRD 4.2:302,305; notas PRD 4.3:365,366.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Registrar gastos operativos de una ruta (descripción + valor) con evidencias (imágenes/PDF), flujo de aprobación (campo aprobado) y trazabilidad, descontando la caja al aprobar (PRD 4.3:366) y revirtiendo al eliminar si estaba aprobado.

## Fuera de alcance
- Liquidación (HU-20, ítem 14), reporte diario (HU-18/50), detalle de ruta (HU-51), dashboard (HU-23).
- S3 / almacenamiento en nube de evidencias (Fase 2, PRD 3.1).
- Auditoría imborrable de edición/eliminación con re-autenticación (HU-48, ítem 12).
- Notificaciones de aprobación (Fase 4).

## Decisiones tomadas durante la implementación
- Evidencias: **almacenamiento local en disco** (carpeta uploads), con `multer`. Metadata en `gasto_evidencias`.
- Aprobación: **registro pendiente (`aprobado=false`) + aprobación posterior**; la caja se descuenta **al aprobar**.
- Eliminación: **soft-delete con `estado`** (activo/eliminado); si estaba aprobado, revierte la caja.
- Permiso de registro: **agregar `registrar_gasto` al enum SOCIO_PERMISOS** (como el cobrador ya lo tiene).
- Permiso de aprobación: **Admin o Socio con `generar_reporte`** + ownership.
- Permiso de eliminación: `eliminar_gastos` + ownership.
- Wiring de caja: transaccional (`dataSource.transaction` + `aplicarMovimiento(..., manager)`), tipo `GASTO`/`GASTO_ELIMINADO`.

## Bloques (checklist TDD)
- [x] Bloque 0: Agregar `registrar_gasto` al enum `SOCIO_PERMISOS` (+ DTO/validación de matriz de socio).
  - Test(s): specs de permisos de socio
- [x] Bloque 1: Entidades `Gasto` y `GastoEvidencia` + `TipoMovimientoCaja.GASTO/GASTO_ELIMINADO` + registro en módulo.
- [x] Bloque 2: `GastosService` — registrar (aprobado=false + evidencias), aprobar (aprobado=true + aprobado_por + descuenta caja), eliminar (soft-delete + revierte caja si aprobado). Todos con ownership + transaccional.
  - Test(s): `src/modules/rutas/gastos.service.spec.ts`
- [x] Bloque 3: Endpoints en rutas.controller — `POST /rutas/:id/gastos` (multipart), `PATCH /rutas/:id/gastos/:gastoId/aprobar`, `DELETE /rutas/:id/gastos/:gastoId`.
  - Test(s): `rutas.controller.spec.ts`, `test/e2e/gastos.e2e-spec.ts`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿almacenamiento evidencias? → **local en disco** (`uploads/gastos`, `UPLOAD_DIR` env, `multer` diskStorage).
- Pregunta: ¿flujo de aprobación? → **registro pendiente + aprobación posterior**.
- Pregunta: ¿eliminación? → **soft-delete con estado**.
- Pregunta: ¿permiso de registro? → **agregar `registrar_gasto` al socio**.
- Pregunta: ¿permiso de aprobación? → **Admin o socio con `generar_reporte`**.
- Pregunta: ¿wiring de caja? → **descontar al aprobar** (revierte al eliminar si aprobado).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 296 tests) y `npm run test:e2e` (20 suites, 166 tests) en verde.
- Archivos modificados: `src/modules/rutas/gasto.entity.ts`, `gasto-evidencia.entity.ts`, `gastos.service.ts` (+spec), `evidencia-upload.ts`, `rutas.controller.ts` (+spec), `rutas.module.ts`, `dto/registrar-gasto.dto.ts`, `src/modules/rutas/caja.service.ts` (tipos GASTO/GASTO_ELIMINADO), `src/modules/socios/socio-permiso.entity.ts` (+registrar_gasto), `test/e2e/gastos.e2e-spec.ts`, `.env.example`, `.gitignore`, `package.json` (+@types/multer), `docs/ai/tasks/backlog.md`, `docs/ai/tasks/registrar-gasto.md`.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES. Atendidas: condición de carrera en aprobar/eliminar corregida con **UPDATE condicional atómico** (`WHERE aprobado=false`/`estado='activo'`, `affected===1` → si no, ForbiddenException sin tocar caja) + tests de concurrencia; `fileFilter` con whitelist de mimetypes (imágenes/PDF) y `limits.fileSize` en el upload; tests positivos de socio con `generar_reporte`, 404/403 en aprobar/eliminar. Registradas en backlog: archivos huérfanos ante fallo posterior al upload, actor Cobrador no alcanza por API (MVP), inyecciones sin lock (mismo patrón), endpoint de descarga de evidencia pendiente.
- Pendientes/seguimiento: endpoint GET de descarga de evidencia (controlar mimetype, backlog); liquidación (HU-20), reporte diario (HU-18/50), detalle (HU-51), dashboard (HU-23); S3 (Fase 2); auditoría imborrable (HU-48, ítem 12); notificaciones de aprobación (Fase 4). **Pendiente commit + PR.**
