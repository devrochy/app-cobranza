# Tarea: apertura-ruta-auditoria (registrar apertura de la ruta del día)

- **Origen:** Plan aprobado del usuario para dejar la APK desarrollada (Fase 4b, 2026-09-01). HU-41 (docs/APP_REQUIREMENTS.md:106): registrar timestamp + coordenadas al abrir la ruta del día.
- **Estado:** completada
- **Fecha inicio:** 2026-09-02
- **Fecha cierre:** 2026-09-02

## Objetivo
Exponer `POST /cobrador/rutas/:rutaId/apertura` que registra fecha, hora de inicio y coordenadas del cobrador al abrir el día, para auditoría de la operación de campo (HU-41).

## Fuera de alcance
- Envío desde la APK (tarea `apk-apertura-ruta` en el repo app-cobranza-apk).
- Geolocalización forzada (las coords son opcionales).

## Bloques (checklist TDD)
- [x] Bloque 1: entidad `RutaApertura` (`rutas_aperturas`) + servicio `RutasAperturaService.registrar` (fecha/hora/coords; idempotente por día).
  - Test(s): `src/modules/rutas/rutas-apertura.service.spec.ts` (3).
- [x] Bloque 2: `CobradorService.registrarApertura` + endpoint `POST /cobrador/rutas/:rutaId/apertura` (`ver_cartera`) con DTO de coords.
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts` (+1), `cobrador.controller.spec.ts` (+1).
- [x] Bloque 3: wiring — `RutaApertura` en `RutasModule` forFeature + export `RutasAperturaService`.
- [x] Bloque 4: e2e — 201 registra apertura; 403 ruta ajena.
  - Test(s): `test/e2e/cobrador-apk.e2e-spec.ts` (+2).

## Decisiones tomadas durante la implementación
- La apertura es idempotente por (ruta, fecha): si ya se abrió hoy, devuelve la existente (no duplicar).
- La hora se calcula en hora local del servidor (no UTC) para reflejar el momento real del cobrador.
- `@RelationId` (rutaId) NO es consultable en `where` (lección de cobrador-apk-api) → el `findOne` usa `ruta: { id: rutaId }`.
- Permiso `ver_cartera` (abrir la ruta del día requiere ver cartera).

## Ambigüedades resueltas con el usuario
- (ninguna abierta)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (819 tests, 96 suites) + e2e cobrador-apk (18 tests).
- Archivos modificados: `src/modules/rutas/ruta-apertura.entity.ts` (nueva), `src/modules/rutas/rutas-apertura.service.ts` (+spec), `src/modules/rutas/dto/registrar-apertura.dto.ts` (nuevo), `src/modules/rutas/rutas.module.ts` (wiring), `src/modules/cobrador/cobrador.service.ts` (+registrarApertura), `src/modules/cobrador/cobrador.service.spec.ts` (+1), `src/modules/cobrador/cobrador.controller.ts` (+endpoint), `src/modules/cobrador/cobrador.controller.spec.ts` (+1), `test/e2e/cobrador-apk.e2e-spec.ts` (+2).
- Pendientes/seguimiento: envío desde la APK (`apk-apertura-ruta`).