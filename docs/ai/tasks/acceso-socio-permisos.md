# Tarea: Acceso del socio limitado a sus permisos habilitados (HU-07)

- **Origen:** HU-07 (docs/APP_REQUIREMENTS.md:36)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Socio pueda autenticarse (`POST /auth/socio/login`) y acceder únicamente a las funciones que su matriz `socio_permisos` tenga habilitadas, vía un `PermisoGuard` por endpoint (403 si no tiene permiso). Además (extensión aprobada por el usuario), un socio con `editar_permisos` puede consultar sus colaboradores y editar la matriz de permisos de sus cobradores (`cobrador_permisos`, desviación explícita del PRD).

## Fuera de alcance
- Login/APK del cobrador (no hay HU) y enforcement real de `cobrador_permisos` (hasta que exista el cliente del cobrador).
- `ruta_config` (HU-10).
- Revalidación per-request del estado del admin (backlog).

## Bloques (checklist TDD)
- [x] Bloque 1: `rol` (admin|socio) en `AuthTokenPayload` + `loginSocio` (valida contra `socios`, rechaza si `estatus !== activo`) + `refresh` rol-aware (consulta la tabla correcta y preserva rol). Tests unitarios.
- [x] Bloque 2: `PermisosSocioService.tienePermiso(socioId, permiso)` + `@PermisoRequerido` + `PermisoGuard` (admin bypass; socio necesita el permiso; sin decorator → admin-only; 403) y aplicación en `SociosController` (registrar_socio, bloquear_socio), `CobradoresController` (registrar_cobrador, bloquear_cobradores) y `AuthController` (/auth/me admin-only). Tests unitarios del guard.
- [x] Bloque 3: catálogo `COBRADOR_PERMISOS` (12) + entidad `CobradorPermiso` (tabla `cobrador_permisos`, FK CASCADE, unique cobrador+permiso) + `CobradoresPermisosService` (`getMatriz`, `setMatriz` transaccional, `assertOwnedBySocio` 403). Tests unitarios.
- [x] Bloque 4: endpoints `GET /cobradores` (admin: todos; socio: los suyos) y `GET`/`PUT /cobradores/:id/permisos`, todos gated por `editar_permisos` con ownership. Tests unitarios del controller.
- [x] Bloque 5: e2e `test/e2e/acceso-socio.e2e-spec.ts` (login socio 200/401 bloqueado; token con rol; socio con permiso 200; socio sin permiso 403; socio en ruta admin 403; admin bypass) y `test/e2e/cobrador-permisos.e2e-spec.ts` (GET /cobradores propios, GET/PUT /cobradores/:id/permisos, ownership 403).

## Decisiones tomadas durante la implementación
- Incluir login + refresh de socio (decisión del usuario).
- Crear matriz `cobrador_permisos` — desviación explícita del PRD 4.2, registrada como decisión de diseño.
- `editar_permisos` (socio) = consultar sus colaboradores + editar la matriz de permisos de sus cobradores (semántica elegida).
- Los permisos de SOCIOS (`GET/PUT /socios/:id/permisos`) quedan admin-only (el admin es quien los edita).
- 403 Forbidden para socio autenticado sin permiso.
- Catálogo `COBRADOR_PERMISOS` de 12: registrar_prestamo, registrar_pago, registrar_abono, registrar_gasto, registrar_no_pago, eliminar_prestamo, eliminar_pago, eliminar_abono, eliminar_gasto, registrar_inyeccion, ver_cartera, generar_reporte.
- `PermisoGuard` por-ruta (`@UseGuards(JwtAuthGuard, PermisoGuard)`), inyecta `PermisosSocioService`; módulos que lo usan deben tener `PermisosSocioService` en contexto (SociosModule lo exporta).

## Ambigüedades resueltas con el usuario
- Pregunta: login del socio → Respuesta: incluir login+refresh.
- Pregunta: permisos a enforcear → Respuesta: modelo de delegación con `cobrador_permisos`.
- Pregunta: 403 vs 401 → Respuesta: 403.
- Pregunta: semántica de `editar_permisos` → Respuesta: consultar colaboradores + editar permisos de sus cobradores.
- Pregunta: catálogo de cobrador → Respuesta: catálogo de 12.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+117 tests unitarios), `npm run test:e2e` (64 tests, 9 suites).
- Archivos modificados: `src/modules/auth/auth.service.ts` (+spec), `auth.controller.ts` (+spec), `auth.module.ts`, `jwt-auth.guard.spec.ts`, `permiso.guard.ts` (+spec), `permiso-requerido.decorator.ts`; `src/modules/socios/permisos-socio.service.ts` (+spec), `socios.controller.ts` (+spec), `socios.module.ts`, `dto/permisos-validos.constraint.ts`, `dto/update-permisos.dto.ts`; `src/modules/cobradores/cobrador-permiso.entity.ts`, `cobradores-permisos.service.ts` (+spec), `cobradores.controller.ts` (+spec), `cobradores.service.ts` (+spec), `cobradores.module.ts`, `dto/update-permisos-cobrador.dto.ts`; `test/e2e/acceso-socio.e2e-spec.ts`, `test/e2e/cobrador-permisos.e2e-spec.ts`; `docs/ai/tasks/acceso-socio-permisos.md`.
- Pendientes/seguimiento: enforcement real de `cobrador_permisos` cuando exista el cliente/login del cobrador (no hay HU); `ruta_config` en HU-10; la matriz de permisos de SOCIOS (`GET/PUT /socios/:id/permisos`) quedó admin-only (decisión aprobada). El constraint de matriz ahora usa `args.constraints` para recibir el catálogo (más robusto que constructor).
- **Revisión independiente (code-reviewer, 2026-08-11):** RECHAZADO inicial por un hallazgo de seguridad bloqueante: `registrar_cobrador`, `bloquear_cobradores` y `bloquear_socio` no verificaban ownership (un socio A podía operar sobre recursos del socio B). Correcciones aplicadas: (1) `PATCH /socios/:id/estatus` (bloquear_socio) → admin-only (decisión del usuario, evita DoS cross-tenant); (2) `POST /cobradores` → el socio solo puede crear cobradores bajo su propio socioId (403 si no); (3) `PATCH /cobradores/:id/estatus` → ownership vía `assertOwnedBySocio` (403 si ajeno). Además: e2e de rutas admin-only sensibles (GET /socios/:id/permisos y bloquear socio), guard con token sin rol → 403. Veredicto final: APROBADO.
- **PR:** (a completar al abrirla)
