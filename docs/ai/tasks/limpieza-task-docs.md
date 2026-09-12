---
estado: en progreso
tags: [tarea]
---

# Tarea: Limpieza de task docs (backend)

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #6, transversal a panel/backend/APK. Normaliza el campo `estado` de `docs/ai/tasks/` al vocabulario canónico del skill `task-decomposition` (`pendiente | en progreso | completada | bloqueada`) y reconcilia cada doc con el estado real en `develop`.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-11

## Objetivo
Dejar los task docs del backend con `estado` canónico y correcto, "Resultado final" completo, y el `backlog.md` depurado.

## Fuera de alcance
- Reescritura/comprimir docs largos.
- Panel y APK (PRs aparte del mismo ítem).

## Bloques (checklist TDD)
- [ ] Bloque 1: verificación caso por caso (slug ↔ PR mergeado + artefactos) de los 99 docs.
- [ ] Bloque 2: normalizar `estado` (vocabulario + faltantes).
- [ ] Bloque 3: rellenar "Resultado final" placeholder.
- [ ] Bloque 4: depurar `backlog.md`.

## Decisiones tomadas durante la implementación
- Verificación por PR mergeado (`gh pr list --head feature/<slug>`), resolviendo por título/rama los que usan otro nombre de rama.
- `link-pago-socio` no aplica (doc en la rama `feature/link-pago-socio`, PR #119 sin mergear; no está en `develop`).

## Ambigüedades resueltas con el usuario
- Verificación caso por caso; 3 PRs docs-only; panel como piloto (ya mergeado/PR #54).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 967 tests) → verde.
- Estado final: **98 docs `completada`** + 1 `en progreso` (esta tarea).
- Verificación caso por caso: 85 docs con PR mergeado por rama + 13 resueltos por título/rama (`cascada-bloqueo`#20, `postgis-migracion`#22, `fix-listado-gastos-evidencia`#72, `fix-socio-ve-recursos`#73, `refactor-helpers`#21, `backend-rediseno-apk-endpoints`#91, `chore-obsidian-frontmatter`#102; los `a1`/`b1`–`b5` ya estaban `completada`).
- Cambios aplicados:
  - 41 docs normalizados: 5 sin frontmatter YAML → se les añadió `estado`+`tags`; `en progreso`→`completada` (YAML y body `- **Estado:**` alineados).
  - 4 "Resultado final" placeholder rellenados: `backend-eliminar-pago` (#93), `backend-liquidacion-cobrador` (#94), `endpoints-inventario` (#90), `restringir-cors` (#81).
  - `backlog.md`: 7 ítems ya resueltos movidos a "Resueltos (historial)" (rate limiting, refresh blacklist, wiring inyección+caja, concurrencia pagos/abonos, concurrencia inyecciones/caja, endpoints de descarga de evidencias).
- Pendientes/seguimiento: `link-pago-socio` no está en `develop` (PR #119 sin mergear; doc vive en su rama). El APK se hace en su PR del mismo ítem #6.
