# Tarea: Registrar inyección de capital (HU-11)

- **Origen:** HU-11 (docs/APP_REQUIREMENTS.md:45)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Administrador o un Socio con `configurar_ruta` registre una inyección de capital (valor + comentario) sobre una ruta (`POST /rutas/:id/inyecciones`), con estado `activa` y timestamp, para reflejar aportes de caja de forma inmediata. Snapshot inmutable (PRD 4.3:274): la eliminación (HU-12) solo cambiará `estado`.

## Fuera de alcance
- Eliminación de inyecciones (HU-12), enforcement APK del cobrador (`registrar_inyeccion_apk`, HU-10 — diferido con la APK).
- Consumo en caja/liquidación (HU-20).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `Inyeccion` (tabla `inyecciones`: rutaId FK RESTRICT, valor numeric, comentario, fechaHora, estado default activa) + `CreateInyeccionDto` (valor > 0, comentario obligatorio) + `InyeccionesService.crear` (404 ruta, ownership, persiste activa) + `POST /rutas/:id/inyecciones` con `@PermisoRequerido("configurar_ruta")`. Tests unitarios.
- [x] Bloque 2: e2e `test/e2e/registrar-inyeccion.e2e-spec.ts` (201 con fechaHora, 404, 400 valor<=0/comentario vacío, 401, 403 ownership).

## Decisiones tomadas durante la implementación
- Gated por `configurar_ruta` + ownership (decisión del usuario) — consistente con 9a/estatus/cobrador/ruta-config.
- Comentario obligatorio (decisión del usuario).
- Estado `activa` al crear; `fechaHora` = timestamp del registro.
- Subrecurso `POST /rutas/:id/inyecciones`.
- `InyeccionesService` en el módulo de rutas con el patrón `assertOwned` (helper compartido en backlog).

## Ambigüedades resueltas con el usuario
- Pregunta: permiso de registro → Respuesta: `configurar_ruta` + ownership.
- Pregunta: comentario → Respuesta: obligatorio.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+172 tests unitarios), `npm run test:e2e` (114 tests, 14 suites).
- Archivos modificados: `src/modules/rutas/inyeccion.entity.ts`, `inyecciones.service.ts` (+spec), `rutas.controller.ts` (+spec), `rutas.module.ts`, `dto/create-inyeccion.dto.ts`, `test/e2e/registrar-inyeccion.e2e-spec.ts`, `docs/ai/tasks/registrar-inyeccion.md`.
- Pendientes/seguimiento: la eliminación es HU-12 (`estado = eliminada`, snapshot inmutable); el enforcement APK del cobrador (`registrar_inyeccion_apk`) queda diferido; `assertOwned` se repite (4to uso en rutas) — el helper compartido sigue en backlog.
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: `@Matches(/\S/)` en el comentario (rechaza solo espacios), e2e de validación parametrizado (valor 0/negativo, comentario vacío/solo espacios), backlog actualizado (4º uso de `assertOwned` + `numericTransformer` duplicado).
- **PR:** (a completar al abrirla)
