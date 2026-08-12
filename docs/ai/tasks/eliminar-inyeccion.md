# Tarea: Eliminar inyección con trazabilidad (HU-12)

- **Origen:** HU-12 (docs/APP_REQUIREMENTS.md:46)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Administrador o un Socio con `eliminar_inyeccion` elimine (soft-delete) una inyección de capital (`DELETE /rutas/:id/inyecciones/:inyeccionId`), cambiando `estado` a `eliminada` sin borrar físicamente el registro, conservando su `fecha_hora` (trazabilidad, PRD 4.3:274).

## Fuera de alcance
- Borrado físico (no aplica — el PRD exige trazabilidad).
- Enforcement APK del cobrador.
- Consumo en caja/liquidación (HU-20) — nota: sumar solo inyecciones `activa`.

## Bloques (checklist TDD)
- [x] Bloque 1: `InyeccionesService.eliminar(rutaId, inyeccionId, requester)` — 404 ruta, 404 inyección (buscada por id+rutaId), ownership, soft-delete idempotente, fechaHora intacta + `DELETE /rutas/:id/inyecciones/:inyeccionId` con `@PermisoRequerido("eliminar_inyeccion")`. Tests unitarios.
- [x] Bloque 2: e2e `test/e2e/eliminar-inyeccion.e2e-spec.ts` (200 estado eliminada y fechaHora conservada en BD, 404, 403, 401, idempotencia).

## Decisiones tomadas durante la implementación
- El verbo DELETE es la confirmación (decisión del usuario) — sin campos extra.
- Soft-delete: `estado = "eliminada"`, registro y `fecha_hora` conservados (PRD 4.3:274).
- Idempotente: re-eliminar una ya eliminada → 200 no-op.
- Gated por `eliminar_inyeccion` (permiso del catálogo) + ownership.
- Búsqueda de la inyección por `id + rutaId` (doble filtro).
- Devuelve la inyección actualizada (estado eliminada) para trazabilidad.

## Ambigüedades resueltas con el usuario
- Pregunta: mecanismo de confirmación → Respuesta: el DELETE es la confirmación.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+178 tests unitarios), `npm run test:e2e` (124 tests, 15 suites).
- Archivos modificados: `src/modules/rutas/inyecciones.service.ts` (+spec), `rutas.controller.ts` (+spec), `test/e2e/eliminar-inyeccion.e2e-spec.ts`, `docs/ai/tasks/eliminar-inyeccion.md`.
- Pendientes/seguimiento: la liquidación (HU-20) debe sumar solo inyecciones `activa`; `assertOwned` sigue acumulando usos (backlog del helper).
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: igualdad de `fechaHora` antes/después del DELETE en e2e (snapshot inmutable a nivel BD), e2e de "socio sin `eliminar_inyeccion` → 403" (primera ruta gated por un permiso distinto de `configurar_ruta`), e2e del doble filtro (inyección de otra ruta → 404), backlog actualizado a 5 usos de `assertOwned`.
- **PR:** https://github.com/devrochy/app-cobranza/pull/14 (feature/eliminar-inyeccion → develop), CI en verde (build-and-test + e2e).
