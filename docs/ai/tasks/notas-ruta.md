# Tarea: Notas de ruta — crear, ver, editar y eliminar (HU-45)

- **Origen:** Roadmap Fase 1 ítem 13 (docs/plan-feature-roadmap.md:31) — HU-45 (docs/APP_REQUIREMENTS.md:51). Tabla PRD 4.2:323 (ruta_notas); permisos `anotar_notas_ruta` (PRD:258 socio, :264 cobrador).
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
CRUD de notas sobre una ruta: crear, ver (listar), editar y eliminar, gated por el permiso `anotar_notas_ruta`. Borrado físico y sin historial de ediciones (editar sobreescribe; se conserva `updated_at`).

## Fuera de alcance
- Historial de ediciones/versiones por nota (descartado por decisión: "sin historial de ediciones").
- Login del cobrador y su invocación real de estos endpoints (rol modelado pero inalcanzable por PermisoGuard en MVP).
- Notas por cliente o trayecto (solo por ruta).
- Panel admin/web (solo API backend).
- Notificaciones/auditoría imborrable (las notas no son financieras).

## Decisiones tomadas durante la implementación
- "Con historial" del roadmap = historial de acontecimientos (notas de distintos días); sin versiones por nota.
- Permiso `anotar_notas_ruta` gatea crear, ver, editar y eliminar (admin siempre; socio con permiso).
- Cualquier operador con permiso y ownership de la ruta (`assertOwned`) opera sobre cualquier nota de la ruta, no solo las propias.
- Borrado físico de la fila.

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `RutaNota` (PRD 4.2:323: ruta_id, nota text, creado_por_rol, creado_por_id, created_at, updated_at) + registro en `RutasModule`.
- [x] Bloque 2: `RutasNotasService` — `crear`, `listar` (orden created_at DESC), `editar`, `eliminar` (físico), con `assertOwned` por ruta. Tests unitarios (8, RED→GREEN).
- [x] Bloque 3: DTOs (crear/editar: `nota` no vacía) + endpoints en `RutasController` con `PermisoRequerido("anotar_notas_ruta")`. Se agregó `anotar_notas_ruta` a `SOCIO_PERMISOS` y `COBRADOR_PERMISOS` (existía en PRD:258/264 pero faltaba en el código).
- [x] Bloque 4: e2e `test/e2e/notas-ruta.e2e-spec.ts` (12 tests: 201 crear, 200 listar/editar/eliminar, 400 vacío/extra/espacios, 404, 403 socio sin permiso, 401, updated_at, socio con permiso en su ruta).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿historial de ediciones? → **No**, sobreescribe + borrado físico (HU-45 literal).
- Pregunta: ¿permiso para ver? → **anotar_notas_ruta** para todo el CRUD.
- Pregunta: ¿editar/eliminar notas ajenas? → **Sí**, con permiso + ownership de ruta.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `notas-ruta.e2e-spec.ts`, 9 tests).
- Archivos modificados:
  - `src/modules/rutas/ruta-nota.entity.ts` (nuevo) — entidad `ruta_notas` (PRD 4.2:323).
  - `src/modules/rutas/rutas-notas.service.ts` (+spec) — CRUD con `assertOwned`.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — 4 endpoints (`POST/GET/PATCH/DELETE /rutas/:id/notas...`) gated por `anotar_notas_ruta`.
  - `src/modules/rutas/dto/crear-nota.dto.ts` (nuevo).
  - `src/modules/rutas/rutas.module.ts` — registro de `RutaNota` + `RutasNotasService`.
  - `src/modules/socios/socio-permiso.entity.ts`, `src/modules/cobradores/cobrador-permiso.entity.ts` — se agregó `anotar_notas_ruta` al enum (PRD:258/264).
  - `test/e2e/notas-ruta.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/notas-ruta.md` (este archivo).
- Pendientes/seguimiento:
  - Login del cobrador para que su permiso `anotar_notas_ruta` sea alcanzable (hoy inalcanzable por PermisoGuard).
  - Panel admin/web (repo separado/Fase posterior).
  - Paginación de GET /rutas/:id/notas (no requerido por PRD; lista completa por ahora).
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Observaciones atendidas: (a) DTO `nota` ahora rechaza solo-espacios (`@Matches(/\S/)`) y acota longitud (`@MaxLength(5000)`); (b) e2e nuevo que verifica `updated_at` (decisión "sin historial, sobreescribe"); (c) e2e nuevo del caso positivo socio CON `anotar_notas_ruta` sobre su propia ruta (cierra el ciclo de HU-45). Nits documentados sin cambio: `CrearNotaDto` reutilizado en editar (naming), cobertura de 403 en editar/eliminar (cubierta por el patrón `validarRuta` y el test de crear).