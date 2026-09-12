---
estado: en progreso
tags: [tarea]
---

# Tarea: Exponer el link de pago del cobro socio en el listado

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #5 del panel: la tabla de cobros del socio no puede mostrar el link de pago porque `GET /cobros-socio` (listado) no carga la relación `linkPago` (solo `obtener` lo hacía). PRD 6.4:422: "el socio lo abre desde la APK o el panel".
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-11

## Objetivo
`GET /cobros-socio` (listado con filtros `socioId`/`periodo`/`estado`) devuelve `linkPago` de cada cobro (`{ id, url, estado, proveedor } | null`), para que el panel renderice el enlace "Abrir link" de los cobros no pagados.

## Fuera de alcance
- Integración real con proveedores de pago (Fase 2/3; `docs/estrategia-metodos-pago-socios.md`).
- Generación de links (ya existe en `crearCobroSiNoExiste`).

## Bloques (checklist TDD)
- [x] Bloque 1: `CobrosSocioService.listar` carga `relations: { linkPago: true }`.
  - Test(s): `src/modules/cobros-socio/cobros-socio.service.spec.ts`

## Decisiones tomadas durante la implementación
- Se carga solo la relación `linkPago` (no `socio`): el panel ya dispone de la moneda del socio por separado y no usa `cobro.socio`.
- Sin cambios de contrato: `linkPago` ya formaba parte de `CobroSocioPublic` devuelto por `obtener`.

## Ambigüedades resueltas con el usuario
- (ninguna; el contrato de `linkPago` ya existía en `obtener` y `CobroSocioPublic`)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 968 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/modules/cobros-socio/cobros-socio.service.ts` (+ `.spec.ts`) — `listar` carga `relations: { linkPago: true }`.
- Pendientes/seguimiento: ninguno.
