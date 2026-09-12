---
estado: en progreso
tags: [tarea]
---

# Tarea: Cambio de contraseña del usuario logueado

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #3 del backlog (el perfil solo edita nombre/apellido; el cambio de contraseña quedó fuera en `perfil-panel`).
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-11

## Objetivo
El usuario autenticado (admin, socio o cobrador) puede cambiar su propia contraseña desde el panel: `PATCH /perfil/password` valida la contraseña actual y guarda la nueva (hasheada).

## Fuera de alcance
- Recuperación de contraseña / reseteo por admin.
- Invalidar sesiones/tokens existentes al cambiar la contraseña (los tokens siguen válidos hasta expirar; se documenta).

## Bloques (checklist TDD)
- [x] Bloque 1: `PerfilService.cambiarPassword` (valida contraseña actual, hashea y guarda la nueva; 400 si la actual es incorrecta).
  - Test(s): `src/modules/perfil/perfil.service.spec.ts`
- [x] Bloque 2: endpoint `PATCH /perfil/password` + DTO `CambiarPasswordDto` (min 8 en la nueva).
  - Test(s): `src/modules/perfil/perfil.controller.spec.ts` + `test/e2e/cambio-password.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Contraseña actual incorrecta → `400 BadRequest` (no 401) para no chocar con el refresh-on-401 del `authedFetch` del panel.
- Nueva contraseña con mínimo 8 caracteres (consistente con socios/cobradores).
- Sin forzar re-login tras el cambio.

## Ambigüedades resueltas con el usuario
- (ninguna; alcance directo Backend + Panel, siguiendo el patrón de las tareas previas)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 959 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/perfil/perfil.service.ts` (+ `.spec.ts`) — `cambiarPassword` (verifica actual, hashea y guarda; 400 si incorrecta).
  - `src/modules/perfil/perfil.controller.ts` (+ `.spec.ts`) — `PATCH /perfil/password` (204).
  - `src/modules/perfil/dto/cambiar-password.dto.ts` — DTO con min 8.
  - `src/modules/perfil/perfil.module.ts` — importa `SecurityModule` (para `PasswordService`).
  - `test/e2e/cambio-password.e2e-spec.ts` — 4 tests.
- Pendientes/seguimiento: sin forzar re-login (los tokens existentes siguen válidos hasta expirar).
