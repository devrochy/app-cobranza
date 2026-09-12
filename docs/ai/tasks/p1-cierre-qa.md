---
estado: en progreso
tags: [tarea]
---

# Tarea: P1 — Cierre MVP/QA (backend)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P1 Cierre MVP/QA**.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Cerrar brechas de QA del MVP: cubrir la cascada socio→cobradores→rutas en e2e, endurecer los casos borde de la API del cobrador, arreglar el e2e flaky de reglas IA y paginar la cartera global.

## Bloques (checklist TDD)
- [x] Bloque 1: e2e de la cascada completa `PATCH /socios/:id/estatus` → cobradores/rutas.
  - Test(s): `test/e2e/estatus.e2e-spec.ts`
- [x] Bloque 2: e2e de casos borde de la API del cobrador.
  - Test(s): `test/e2e/cobrador-apk.e2e-spec.ts`
- [x] Bloque 3: fix del e2e flaky `reglas-negociacion-ia`.
  - Test(s): `test/e2e/reglas-negociacion-ia.e2e-spec.ts`
- [x] Bloque 4: paginación de cartera global (`page`/`limit` + `{ items, total, page, limit }`).
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`, `test/e2e/cartera-reportes-global.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Paginación: `page` (default 1), `limit` (default 20, máx 100); respuesta `{ items, total, page, limit }`. Contrato cambia de array a sobre (el panel se actualiza en su PR).
- Flaky `reglas-negociacion-ia`: no reproducible tras el diagnóstico (5 corridas completas + 15 aisladas verdes); se endureció el test para ser autocontenido (hace su propio `PUT`) y se atribuyó a factor ambiental (acceso manual concurrente a la misma BD). Entrada del backlog marcada como resuelta.
- Cascada e2e: se creó una ruta para el cobrador del socio y se asertó el estatus persistido de cobrador y ruta al bloquear/reactivar el socio.

## Ambigüedades resueltas con el usuario
- Incluir paginación; backend primero.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (110 suites, 990 tests) + `npm run test:e2e` (58 suites, 421 tests) → verde (3 corridas completas consecutivas).
- Archivos modificados:
  - `test/e2e/estatus.e2e-spec.ts` — cascada socio→cobradores→rutas.
  - `test/e2e/cobrador-apk.e2e-spec.ts` — 6 casos borde (mimetype inválido, sin archivos, trayectoria <2 puntos, tarjeta de otra ruta, mis-rutas sin ver_cartera, sin token).
  - `test/e2e/reglas-negociacion-ia.e2e-spec.ts` — test autocontenido.
  - `src/modules/cartera/cliente.service.ts` (+ `.spec.ts`) y `dto/listar-clientes-global.dto.ts` — paginación de cartera global.
  - `test/e2e/cartera-reportes-global.e2e-spec.ts` — adapta al sobre `{ items }`.
  - `docs/ai/tasks/backlog.md` — flaky marcado resuelto.
- Pendientes/seguimiento: el panel debe adaptarse al nuevo contrato de `/cartera/clientes` (PR de panel).
