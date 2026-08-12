# Tarea: Registrar ruta (HU-08)

- **Origen:** HU-08 (docs/APP_REQUIREMENTS.md:42)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Socio o Administrador registre una Ruta (`POST /rutas`) con nombre, descripción, socio, cobrador, tipo de interés, número de cuotas y moneda; cablear el bloqueo en cascada de rutas al bloquear/activar un cobrador (diferido de HU-05); y permitir la reactivación manual y la reasignación de cobrador de una ruta.

## Fuera de alcance
- Edición del nombre de ruta (HU-09), `ruta_config` (HU-10), clientes/préstamos (HU-14+).
- Interés por préstamo/cliente (HU-14).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `Ruta` (tabla `rutas`, FK socio y cobrador RESTRICT) + `RutasService.create()` (404 socio/cobrador inexistentes, 409 si bloqueados, ownership de socio sobre sus recursos) + `POST /rutas` con `@PermisoRequerido("registrar_ruta")`. Tests unitarios.
- [x] Bloque 2: `RutasService.aplicarCascada(cobradorId, bloqueado)` + cablear en `CobradoresService.setEstatus` (reemplaza el hook no-op) con `CobradoresModule` importando `RutasModule`. Tests unitarios.
- [x] Bloque 3: `PATCH /rutas/:id/estatus` (reactivación manual) y `PATCH /rutas/:id/cobrador` (reasignación con validación de pertenencia al socio y no bloqueado), gated por `configurar_ruta` con ownership. Tests unitarios.
- [x] Bloque 4: e2e `test/e2e/rutas.e2e-spec.ts` (registro 201, ownership 403, socio/cobrador bloqueado 409, cascada bloqueo/reactivación, reactivación manual, reasignación, 400/401).

## Decisiones tomadas durante la implementación
- Cascada completa en HU-08: bloquear cobrador → rutas bloqueadas; reactivar → rutas activas; además `PATCH /rutas/:id/estatus` (manual) y `PATCH /rutas/:id/cobrador` (reasignar) (decisión del usuario).
- Ownership: un socio solo registra rutas bajo su propio `socioId` y el cobrador debe pertenecerle (decisión del usuario).
- Rechazar si el socio o el cobrador están bloqueados → 409 (decisión del usuario).
- `tipo_interes` de la ruta = tasa por defecto (default), requerido > 0; el interés real se acuerda por préstamo en HU-14 (decisión del usuario).
- Permisos: `registrar_ruta` para crear; `configurar_ruta` para estatus/reasignación (mapeo de diseño documentado — el catálogo no tiene uno específico).
- Al reasignar a un cobrador activo, la ruta queda `activo`.
- `CobradoresModule` importa `RutasModule` (sin ciclo: RutasModule no importa CobradoresModule).

## Ambigüedades resueltas con el usuario
- Pregunta: cascada de rutas → Respuesta: implementar en HU-08 con bloqueo+reactivación, más reactivación manual y reasignación de cobrador.
- Pregunta: ownership → Respuesta: sobre sus recursos.
- Pregunta: validaciones de estado → Respuesta: rechazar si socio o cobrador bloqueados.
- Pregunta: tipo_interes → Respuesta: mantener como default requerido > 0.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+144 tests unitarios), `npm run test:e2e` (79 tests, 10 suites).
- Archivos modificados: `src/modules/rutas/ruta.entity.ts`, `rutas.service.ts` (+spec), `rutas.controller.ts` (+spec), `rutas.module.ts`, `dto/create-ruta.dto.ts`, `dto/reasignar-cobrador.dto.ts`; `src/modules/cobradores/cobradores.service.ts` (+spec), `cobradores.module.ts`; `src/app.module.ts`; `test/e2e/rutas.e2e-spec.ts`; `test/jest-e2e.config.js`; `docs/ai/tasks/registrar-ruta.md`.
- **Infra e2e**: se fijó `testTimeout: 30000` y `maxWorkers: 1` en `test/jest-e2e.config.js`. Con 10 suites compartiendo la misma Postgres en paralelo, el boot del AppModule y los pools de conexión saturaban/hacían flaky la suite (timeouts de hook, residuo por afterAll crasheado). La ejecución serial es determinista (~25s) y evita colisiones de datos entre suites.
- **Nota técnica**: `@RelationId` no se rehidrata tras `save()`; `toPublic` de rutas asigna `socioId`/`cobradorId` explícitamente tras crear/reasignar (evita ids obsoletos).
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: e2e 400 de reglas de negocio (tipoInteres 0, numCuotas 0, moneda inválida); DTO propio `UpdateEstatusRutaDto` (valida contra `RUTA_ESTATUS`, evita acoplamiento a socios); renombrado el test del hook de cascada; limpieza de export innecesario; documentado el escape hatch de reactivación manual con cobrador bloqueado. Registrado en backlog: transaccionalidad de la cascada (save del cobrador + update de rutas sin transacción).
- **PR:** (a completar al abrirla)
