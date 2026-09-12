---
estado: en progreso
tags: [tarea]
---

# Tarea: P0.1 — Concurrencia transaccional (decidirPropuesta + trayectorias)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P0 Robustez+seguridad**; ítems del backlog: "Race condition TOCTOU en decidirPropuesta (HU-47)", "registrarReal de trayectoria no transaccional (HU-49)" y "Consolidación de trayectorias toma último log por tipo sin filtrar por día (HU-49)".
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-12

## Objetivo
Eliminar ventanas de carrera en la decisión de propuestas de cliente y en la persistencia/consolidación de trayectorias.

## Fuera de alcance
- P0.2 (reglas financieras), P0.3 (sesión), P0.4 (evidencias).

## Bloques (checklist TDD)
- [x] Bloque 1: `ClienteService.decidirPropuesta` usa UPDATE condicional `WHERE estado='pendiente'` + `affected` (evita doble aprobación/rechazo).
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`
- [x] Bloque 2: `TrayectoriasService.registrarReal` persiste log + reporte dentro de una transacción.
  - Test(s): `src/modules/rutas/trayectorias.service.spec.ts`
- [x] Bloque 3: `generarReporteDiario` filtra los logs por la fecha del reporte (no toma logs de otro día).
  - Test(s): `src/modules/rutas/trayectorias.service.spec.ts`

## Decisiones tomadas durante la implementación
- `decidirPropuesta`: el chequeo de estado fuera de la transacción se conserva como fast-path; la garantía real es el `UPDATE ... WHERE estado='pendiente'` con `affected` (Postgres READ COMMITTED reevalúa el WHERE tras el lock de fila).
- `generarReporteDiario` acepta un `EntityManager` opcional para reutilizar la transacción de `registrarReal`; el `assertOwned` se mantiene con el `rutaRepo` inyectado.
- Los logs se filtran por `fecha` exacta y se ordenan por `id DESC` (antes `fecha DESC, id DESC` sin filtro).

## Ambigüedades resueltas con el usuario
- (ninguna)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 971 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/cartera/cliente.service.ts` (+ `.spec.ts`) — `decidirPropuesta` con UPDATE condicional.
  - `src/modules/rutas/trayectorias.service.ts` (+ `.spec.ts`) — `registrarReal` transaccional + `generarReporteDiario` con `manager` y filtro por fecha.
- Pendientes/seguimiento: ninguno.
