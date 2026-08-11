# Tarea: Bloquear o activar socio y cobrador (HU-05)

- **Origen:** HU-05 (docs/APP_REQUIREMENTS.md:34)
- **Estado:** completada
- **Fecha inicio:** 2026-08-11

## Objetivo
Que un Administrador autenticado bloquee o active un Socio y un Cobrador (`PATCH /socios/:id/estatus`, `PATCH /cobradores/:id/estatus`), para suspender operaciones ante mora, incumplimiento o desvinculación. El bloqueo del cobrador deja el punto de integración de la cascada de rutas para HU-08 (la tabla `rutas` aún no existe).

## Fuera de alcance
- Cascada real de rutas del cobrador (HU-08 — punto de integración documentado).
- Enforcement de acceso de socios/cobradores bloqueados (HU-07: aún no hay login de socio/cobrador).
- Bloqueo en cascada socio → cobradores (decisión del usuario: lectura literal de HU-05).
- Permisos (HU-06).

## Bloques (checklist TDD)
- [x] Bloque 1: `UpdateEstatusDto` (estatus requerido) + `SociosService.setEstatus()` (404, idempotente, respuesta sin passwordHash) + `PATCH /socios/:id/estatus` con `JwtAuthGuard`. Tests unitarios.
- [x] Bloque 2: `CobradoresService.setEstatus()` (misma lógica + hook `bloquearRutasEnCascada` no-op documentado) + `PATCH /cobradores/:id/estatus`. Tests unitarios.
- [x] Bloque 3: e2e `test/e2e/estatus.e2e-spec.ts` (PATCH socio y cobrador: 200 con estatus nuevo, 404, 400 estatus inválido, 401 sin token).

## Decisiones tomadas durante la implementación
- `PATCH /:id/estatus` con body `{ estatus }` (decisión aprobada).
- Idempotente: aplicar el mismo estatus → 200 no-op.
- Toggle ahora + cascada de rutas en HU-08 (decisión del usuario) — limitación conocida explícita.
- Bloquear socio NO cascada a sus cobradores (decisión del usuario, lectura literal).
- `UpdateEstatusDto` único reutilizado por ambos controllers (valores de estatus idénticos); se evita duplicación.
- El enforcement de acceso real quedará con el login de HU-07.

## Ambigüedades resueltas con el usuario
- Pregunta: cascada de rutas sin tabla → Respuesta: toggle ahora + cascada en HU-08.
- Pregunta: bloqueo de socio → Respuesta: solo el socio (sin cascada a cobradores).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+78 tests unitarios), `npm run test:e2e` (37 tests: health, auth, socios, cobradores, edicion, estatus).
- Archivos modificados: `src/modules/socios/socios.service.ts` (+spec), `socios.controller.ts` (+spec), `dto/update-estatus.dto.ts`; `src/modules/cobradores/cobradores.service.ts` (+spec), `cobradores.controller.ts` (+spec); `test/e2e/estatus.e2e-spec.ts`; `docs/ai/tasks/bloquear-socio-cobrador.md`.
- Pendientes/seguimiento (limitaciones conocidas explícitas): la cascada de rutas se implementará en HU-08 (hook `bloquearRutasEnCascada` no-op documentado en `CobradoresService`); el enforcement de acceso de bloqueados llega con el login de HU-07. `UpdateEstatusDto` se reutiliza desde `socios/dto` en el controller de cobradores (valores de estatus idénticos) — revisar si molesta al extraer helpers compartidos.
- **Revisión independiente (code-reviewer, 2026-08-11):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: e2e 400/401 para cobrador, verificación de que el hash de la contraseña persiste tras `setEstatus` (socio y cobrador), e2e de idempotencia, ítem de backlog ampliado con `setEstatus`. Notas aceptadas: `UpdateEstatusDto` compartido (acoplamiento aceptable para MVP, mover a `src/common/` al extraer helpers), guard sin rol admin hasta HU-07.
- **PR:** (a completar al abrirla)
