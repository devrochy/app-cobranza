# Tarea: Matriz de permisos por socio (HU-06)

- **Origen:** HU-06 (docs/APP_REQUIREMENTS.md:35)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador autenticado configure y consulte la matriz de permisos de un Socio (`GET`/`PUT /socios/:id/permisos`), usando el catálogo de 20 permisos del PRD 4.2 (:214). Solo configuración — el enforcement del acceso del socio es HU-07.

## Fuera de alcance
- Enforcement del acceso del socio según permisos (HU-07).
- `ruta_config` (permisos APK del cobrador) — HU-10.
- Cambios en HU-02 (default lazy: ausencia de fila = deshabilitado).

## Bloques (checklist TDD)
- [x] Bloque 1: Catálogo `SOCIO_PERMISOS` (20 permisos) + entidad `SocioPermiso` (tabla `socio_permisos`, FK socio CASCADE, unique socio+permiso) + `PermisosSocioService` (`getMatriz` matriz completa con ausentes=false; `setMatriz` reemplazo total transaccional, claves ausentes=false, 404 si el socio no existe). Tests unitarios.
- [x] Bloque 2: `UpdatePermisosDto` (objeto de permisos→boolean, valida claves del catálogo y valores booleanos, 400 si inválido) + rutas `GET`/`PUT /socios/:id/permisos` en `SociosController` con `JwtAuthGuard`. Tests unitarios del controller.
- [x] Bloque 3: e2e `test/e2e/permisos.e2e-spec.ts` (GET inicial todo false, PUT habilita y GET lo refleja, PUT reemplaza, 404 socio inexistente, 400 clave inválida, 401 sin token).

## Decisiones tomadas durante la implementación
- Default: todos deshabilitados; ausencia de fila = `false` (decisión del usuario). Sin cambios en HU-02.
- `PUT /socios/:id/permisos` reemplazo total (decisión del usuario); body objeto `{ permiso: boolean }`, claves ausentes = `false`.
- `PermisosSocioService` dentro de `SociosModule` (acoplado al socio).
- Persistencia: se materializan las 20 filas en el PUT (delete + insert en transacción) → GET trivial y consistente.
- **Matriz vacía `{}` es válida** = "deshabilitar todos" (coherente con "claves ausentes = false"); se acepta tras la revisión.

## Ambigüedades resueltas con el usuario
- Pregunta: matriz por defecto → Respuesta: todos deshabilitados (ausencia = false).
- Pregunta: forma de configuración → Respuesta: PUT reemplazo total.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+85 tests unitarios), `npm run test:e2e` (46 tests: 7 suites, incluye permisos).
- Archivos modificados: `src/modules/socios/socio-permiso.entity.ts`, `permisos-socio.service.ts` (+spec), `socios.controller.ts` (+spec), `socios.module.ts`, `dto/update-permisos.dto.ts`, `dto/permisos-validos.constraint.ts`, `test/e2e/permisos.e2e-spec.ts`, `docs/ai/tasks/matriz-permisos-socio.md`.
- Pendientes/seguimiento: HU-07 consumirá esta matriz (enforcement); formato fijado: GET/PUT devuelven la matriz completa de 20 con ausentes=false.
- **Revisión independiente (code-reviewer, 2026-08-11):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: matriz vacía `{}` aceptada como "deshabilitar todo", test de rollback en el servicio, e2e de casos borde (matriz vacía, valor no booleano, matriz como array), "PUT reemplaza" autocontenido, ítem de backlog para revalidar el estado del admin en el guard. Nota: validación de tipos booleanos vive en el DTO (el servicio re-chequea claves, no tipos) — aceptado como contrato TS.
- **PR:** (a completar al abrirla)
