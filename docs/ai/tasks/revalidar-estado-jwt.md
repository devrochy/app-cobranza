# Tarea: Revalidar el estado del usuario en cada request (JwtAuthGuard)

- **Origen:** HU-05/HU-61 (docs/APP_REQUIREMENTS.md:34 y 44) + backlog "JwtAuthGuard no revalida el estado del admin por request"
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Que `JwtAuthGuard` revalide en cada petición autenticada que el usuario (admin/socio/cobrador) sigue activo (`estado`/`estatus = activo`), de modo que un bloqueo (manual o automático por mora, HU-61) surta efecto de inmediato y no al expirar el token de 15 min.

## Fuera de alcance
- Login/refresh (ya validan el estado al emitir/rotar tokens).
- Bloqueo en cascada socio → cobradores → rutas (tarea aparte en Fase 0).
- Cobro a socios (HU-60) y el job de bloqueo automático (HU-61) — solo se prepara el mecanismo de revalidación.
- Login de cobrador (aún no existe); solo se deja preparado el manejo del rol en el guard.

## Bloques (checklist TDD)
- [x] Bloque 1: `JwtAuthGuard` revalida el estado en cada request consultando la tabla del rol (admin → `admin_users.estado`, socio → `socios.estatus`, cobrador → `cobradores.estatus`); si el registro no existe o no está activo → 401. El rol del token debe admitir `cobrador` (se extiende `RolUsuario`).
  - Test(s) que lo prueban: `src/modules/auth/jwt-auth.guard.spec.ts` (nuevos casos: bloqueado admin/socio/cobrador rechazado, activo permitido).
- [x] Bloque 2: Ajustar los tests existentes del guard al nuevo constructor (mock de `DataSource`) y confirmar que toda la suite sigue en verde.
  - Test(s) que lo prueban: `src/modules/auth/jwt-auth.guard.spec.ts` + `scripts/check.sh`.

## Decisiones tomadas durante la implementación
- Se inyecta `DataSource` (TypeORM) en el guard en lugar de repositorios por módulo: evita tener que añadir entidades a `TypeOrmModule.forFeature` en rutas/cartera/socios/cobradores, que usan `@UseGuards(JwtAuthGuard)` sin importar AuthModule.
- Se extiende `RolUsuario` a `"admin" | "socio" | "cobrador"` y se amplía el tipo `RequesterContext`/`Requester*Context` de los 5 servicios que lo consumen (rutas, ruta-config, inyecciones, cliente, prestamo) a `RolUsuario` para no romper el tipado (PermisoGuard ya trata al cobrador como no autorizado hasta que exista su login).
- Los specs de controllers que proveen `JwtAuthGuard` ahora incluyen `{ provide: DataSource, useValue: {} }` (auth, cartera, rutas, socios, cobradores).

## Ambigüedades resueltas con el usuario
- Ninguna (decisión técnica de implementación, documentada aquí).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 210 tests unitarios en verde).
- Archivos modificados en la rama `feature/revalidar-estado-jwt` (desde `develop`): `src/modules/auth/jwt-auth.guard.ts`, `src/modules/auth/auth.service.ts` (RolUsuario), `src/modules/auth/jwt-auth.guard.spec.ts`, `src/modules/rutas/{rutas,ruta-config,inyecciones}.service.ts`, specs de controllers (auth, rutas, socios, cobradores), `docs/ai/tasks/revalidar-estado-jwt.md`.
- **Pendiente (tipado preparatorio de cartera):** la extensión de `RequesterContext` → `RolUsuario` en `src/modules/cartera/{cliente,prestamo}.service.ts` y el mock de `DataSource` en `src/modules/cartera/cartera.controller.spec.ts` NO se incluyeron en esta rama porque esos archivos solo existen en `feature/registrar-prestamo` (PR #17, no mergeada a `develop`). Quedan preservados en el stash `stash@{0}` y deben aplicarse cuando la PR #17 se mergee a `develop`. Son solo de tipado preparatorio (no afectan la funcionalidad del guard; `npx tsc --noEmit` pasa sin ellos).
- Pendientes/seguimiento: la cascada de bloqueo socio → cobradores → rutas es la tarea siguiente de Fase 0; el job de bloqueo automático por mora (HU-61) y el cobro de socios (HU-60) se construyen en Fase 5 según el roadmap.