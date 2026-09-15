---
estado: completada
tags: [tarea]
---

# Tarea: P2 — Exponer coordenadas en la tarjeta del cliente (backend)

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P2**; ítem del backlog APK "Mapa 'Cómo llegar' no refleja la nueva ubicación tras guardar".
- **Estado:** completada
- **Fecha inicio:** 2026-09-12

## Objetivo
Que `GET /cobrador/rutas/:id/clientes/:clienteId/tarjeta` devuelva `latitud`/`longitud` (negocio) y `latitudDomicilio`/`longitudDomicilio`, para que la APK refresque el mapa tras editar la ubicación.

## Bloques (checklist TDD)
- [x] Bloque 1: `ClienteTarjetaPublic` + `ClienteTarjetaService.obtener` exponen las coordenadas.
  - Test(s): `src/modules/cartera/cliente-tarjeta.service.spec.ts`

## Decisiones tomadas durante la implementación
- Las coordenadas se derivan con `fromPoint` de `cliente.ubicacion`/`cliente.ubicacionDomicilio`.
- Contrato aditivo (solo agrega campos).

## Ambigüedades resueltas con el usuario
- Bloque P2: mapa "Cómo llegar" stale.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (110 suites, 990 tests) + `npm run test:e2e` (58 suites, 421 tests) → verde.
- Archivos modificados:
  - `src/modules/cartera/cliente-tarjeta.service.ts` (+ `.spec.ts`) — coordenadas en la tarjeta.
- Pendientes/seguimiento: la APK consume los nuevos campos (PR aparte).