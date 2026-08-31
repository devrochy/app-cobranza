# Tarea: login-cobrador (login y rol cobrador en auth)

- **Origen:** Plan del APK del cobrador (Paso 1) aprobado por el usuario 2026-08-31. La APK (Expo, modo en línea) necesita autenticarse como cobrador con JWT.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Que un cobrador activo pueda iniciar sesión (`POST /auth/cobrador/login`), obtener su par de tokens con `rol: "cobrador"` y rotarlos vía refresh. El `JwtAuthGuard` ya revalida el estado del cobrador (Fase 0 ítem 1, preexistente).

## Fuera de alcance (siguientes tareas del APK)
- Acceso del cobrador a endpoints de dominio (PermisoGuard con `cobrador_permisos`) y `assertOwned` del cobrador por `ruta.cobradorId` — requiere auditar todas las rutas y es una tarea aparte (`acceso-cobrador-dominio`).
- Aplicar eventos offline al dominio (`aplicar-offline-dominio`).
- Vinculación IMEI/WhatsApp (Épica 8).

## Bloques (checklist TDD)
- [x] Bloque 1: `AuthService.loginCobrador(usuario, password)` → `CobradorLoginResult` (tokens rol cobrador + cobrador público). Rechazos: credenciales inválidas (mismo error si no existe), cobrador bloqueado.
  - Test(s): `src/modules/auth/auth.service.spec.ts`
- [x] Bloque 2: `POST /auth/cobrador/login` (reutiliza `LoginDto`).
  - Test(s): `src/modules/auth/auth.controller.spec.ts`
- [x] Bloque 3: `AuthService.refresh` ramifica rol cobrador: rota el par consultando la tabla cobradores; rechaza inexistente/bloqueado (hoy caería en el bloque admin → 401 accidental).
  - Test(s): `src/modules/auth/auth.service.spec.ts`
- [x] Bloque 4: e2e en `test/e2e/auth.e2e-spec.ts` (o archivo nuevo `login-cobrador.e2e-spec.ts`): login 201 con tokens + payload cobrador, 401 con password incorrecta, 401 si bloqueado, refresh cobrador rota, refresh rechaza cobrador bloqueado.
  - Test(s): `test/e2e/login-cobrador.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Ruta `POST /auth/cobrador/login` (consistente con `POST /auth/socio/login`), NO `/cobradores/login` como decía el plan aprobado — el controller `/cobradores` es gestión admin; el login vive en `/auth`. Desviación documentada.
- El `passwordHash` del cobrador es `select: false`: el `findOne` usa `addSelect` (o select explícito) para comparar.
- `PermisoGuard` NO cambia en esta tarea (se auditará en `acceso-cobrador-dominio`).

## Ambigüedades resueltas con el usuario
- (ninguna; decisión de ruta documentada arriba)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` (unitarios) y `scripts/test-e2e.sh login-cobrador` (e2e completos, 352 tests / 51 suites).
- Archivos modificados:
  - `src/modules/auth/auth.service.ts` — `loginCobrador` + rama cobrador en `refresh` + `CobradorLoginResult`.
  - `src/modules/auth/auth.module.ts` — registra `Cobrador` en `TypeOrmModule.forFeature`.
  - `src/modules/auth/auth.controller.ts` — `POST /auth/cobrador/login`.
  - `src/modules/auth/auth.service.spec.ts` (+7 tests), `src/modules/auth/auth.controller.spec.ts` (+1 test).
  - `test/e2e/login-cobrador.e2e-spec.ts` (nuevo, 5 tests).
  - `docs/ai/tasks/login-cobrador.md` (este archivo).
- Pendientes/seguimiento: `PermisoGuard` con `cobrador_permisos` + `assertOwned` cobrador + auditar rutas → tarea `acceso-cobrador-dominio` (próximo paso del APK). Revalidación de estado del cobrador en `JwtAuthGuard` ya existía.