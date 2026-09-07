---
estado: completada
tags: [tarea]
---

# Tarea: dashboard-socio-permiso (GET /dashboard accesible para socio con ver_reportes)

- **Origen:** Petición directa del usuario (sesión opencode 2026-09-06) — juanita (socio
  con todos los permisos) no accede a su dashboard.
- **Estado:** completada (PR #100 mergeado a `develop`, SHA `82ea462`)
- **Fecha inicio:** 2026-09-06

## Objetivo
Que un rol `socio` pueda consumir `GET /dashboard` (su propio dashboard). El PR #97
habilitó el handler (forzar `socioId = sub`), pero el `PermisoGuard` bloquea a todo
socio en rutas sin `@PermisoRequerido`, sin importar sus permisos.

## Causa raíz
`GET /dashboard` no tenía `@PermisoRequerido` → PermisoGuard: `rol !== "admin" && rol !==
"socio"` no aplica, pero para socio `!permisoRequerido` → Forbidden (los permisos no se
consultan porque no hay decorador). Con todos los permisos, juanita seguía en 403.

## Bloques (checklist TDD)

- [x] Bloque 1: `@PermisoRequerido("ver_reportes")` en `GET /dashboard` (admin siempre pasa;
  socio con `ver_reportes` pasa; cobrador bloqueado — sin leak).
  - Test(s): `dashboard.controller.spec.ts` (metadata del permiso + tests existentes de socio/admin).

## Decisiones tomadas durante la implementación
- Se usa `ver_reportes` (permiso de lectura del panel, consistente con rutas/socios) en
  vez de quitar el PermisoGuard, que permitiría a un cobrador llamar con `socioId` arbitrario.
- El handler conserva el forcing `socioId = sub` y descarte de `rutaId` para rol socio.

## Ambigüedades resueltas con el usuario
- Pregunta: opción recomendada `@PermisoRequerido("ver_reportes")` → Respuesta: aprobada.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `npx jest src/modules/dashboard` (14 tests) + `scripts/check.sh`.
- Archivos modificados: `src/modules/dashboard/dashboard.controller.ts` + `dashboard.controller.spec.ts`, `docs/ai/tasks/dashboard-socio-permiso.md`.
- Pendientes/seguimiento: probar login real de juanita (socio → /dashboard).