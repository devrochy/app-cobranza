---
estado: completada
tags: [tarea]
---

# Tarea: filtros-clientes-notificaciones (backend)

- **Origen:** Petición del usuario (2026-09-17) — soporte backend para la APK (filtros de clientes y campana de notificaciones).
- **Estado:** completada
- **Fecha inicio:** 2026-09-17

## Objetivo
1. `GET /gestor/carteras/:id/clientes` devuelve `numPrestamos` y `diasMora` por cliente (para filtros al día / en mora / sin préstamos).
2. Nuevo `GET /gestor/notificaciones` que agrega eventos recientes de las carteras del requester (pago, gasto, no_pago, aprobacion, liquidacion).

## Fuera de alcance
- Estado "leído/no leído" en BD (se resuelve en el dispositivo con `lastSeen`).
- Notificaciones push/tiempo real (polling desde la APK).

## Bloques (checklist TDD)
- [x] Bloque 1: `ClienteService.listarConEstado` (diasMora + numPrestamos en una sola consulta agregada); el endpoint del gestor lo usa.
  - Test(s): `src/modules/clientes/cliente.service.spec.ts`; e2e `test/e2e/gestor-apk.e2e-spec.ts`.
- [x] Bloque 2: `NotificacionesFeedService` + `GET /gestor/notificaciones`.
  - Test(s): `src/modules/gestor/notificaciones-feed.service.spec.ts`, `gestor.controller.spec.ts`; e2e `gestor-apk.e2e-spec.ts`.

## Decisiones
- `diasMora` = días desde la cuota vencida más antigua de préstamos vigentes (misma semántica que la tarjeta del cliente, `diasDeMora`).
- `numPrestamos` = préstamos vigentes del cliente.
- Feed: UNION ALL sobre pagos, gastos (activos), visitas no-pago, cambios aprobados y liquidaciones; `ORDER BY fecha DESC LIMIT 30`. Scope: propietario→sus carteras; gestor→sus carteras.
- `id` de notificación = `${tipo}-${refId}` para unicidad entre tipos.

## Resultado final
- Comandos: `scripts/check.sh` verde (120 suites / 1024 tests); e2e `gestor-apk` y `ampliar-cliente` verdes.
- Archivos: `src/modules/clientes/cliente.service.ts` (+`listarConEstado`/`ClienteCarteraPublic`), `src/modules/gestor/{gestor.service,gestor.controller,gestor.module,notificaciones-feed.service}.ts`, specs, e2e.
- Pendientes/seguimiento: `test/e2e/reporte-diario.e2e-spec.ts` falla 2 tests **ya en `develop`** (contaminación de datos del e2e; verificado con `git stash`), ajeno a esta tarea. Candidato a backlog.
