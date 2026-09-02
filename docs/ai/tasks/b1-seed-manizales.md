# Tarea: B1 — Ruta de prueba Manizales/COP con nombres reales y multi-préstamo

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic B1).
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
Agregar al seed de datos de prueba una ruta nueva `test-Ruta Manizales` con moneda COP, clientes georeferenciados en Manizales con nombres reales, préstamos + pagos, algunos clientes con 2–3 préstamos (vigente + liquidado/cancelado) y un trayecto planificado generado.

## Fuera de alcance
- Cambiar la ruta existente (Santa Cruz/BOB) — se conserva.
- Recálculo dinámico del trayecto (HU-36) — backlog.
- Endpoints de tiempo real (B3) — epic aparte.

## Bloques (checklist TDD)
- [x] Bloque 1: Datos de Manizales (clientes con nombre/apellido reales, coords en Manizales, teléfonos +57) en el seed.
- [x] Bloque 2: `semilla` crea `test-Ruta Manizales` (COP) + clientes + préstamos (multi-préstamo para algunos) + pagos + abono + trayecto planificado generado.
- [x] Bloque 3: `sincronizarDataDePrueba` crea la ruta Manizales si el socio existe sin ella (idempotente).
- [x] Verificación: `scripts/check.sh` verde (823 tests) + spec del seed (6 tests).

## Decisiones tomadas durante la implementación
- Moneda COP en la ruta Manizales (socios/rutas ya soportan ISO 4217).
- Coordenadas de Manizales: centro ~5.07, −75.52 con dispersión ~0.01–0.02.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿reemplazar o agregar ruta? → **Agregar ruta nueva Manizales/COP**.
- Pregunta: nombres reales y multi-préstamo → **sí**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 823 tests) + spec seed 6 tests.
- Archivos modificados:
  - `src/modules/test-data/test-data.seed.service.ts` — `sembrarManizales` (ruta COP, clientes reales, multi-préstamo, trayecto), inyección de `RutaOptimizacionService`, re-siembra idempotente.
  - `src/modules/test-data/test-data.seed.service.spec.ts` — mocks nuevos + assertions de Manizales.
  - `docs/ai/tasks/b1-seed-manizales.md` (este archivo).
- Pendientes/seguimiento: reiniciar backend live para sembrar la ruta Manizales (hecho, ruta 1785). El caso de 3 préstamos se observa en una siembra desde cero (seed idempotente no re-siembra la ruta ya poblada); el cliente Andrés Giraldo (id 1219) ya muestra 2 préstamos (liquidado + vigente).