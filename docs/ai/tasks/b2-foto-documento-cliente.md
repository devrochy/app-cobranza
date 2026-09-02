# Tarea: B2 — fotoUrl en lista de clientes + endpoint cobrador de evidencias

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic B2) + decisión "foto real en lista + backend".
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
1. `ClientePublic` incluye `fotoUrl` (de la evidencia `foto_facial`) para que la APK muestre avatar con foto real en las listas.
2. Endpoint `POST /cobrador/rutas/:rutaId/clientes/:clienteId/evidencias` (multipart `foto_facial`/`documento_frente`/`documento_reverso`, permiso `actualizar_cliente`, flags de ruta) para que el cobrador registre foto y documento del cliente.

## Fuera de alcance
- Reconocimiento facial / lectura de documento (flags ya existen, sin procesamiento).
- Propuestas de cambio de cliente (HU-47) — el alta de evidencias es directo.

## Bloques (checklist TDD)
- [x] Bloque 1: `ClienteService.listar` carga `fotoUrl` por cliente; `toPublic` lo incluye (unit 1 test + assert en listar).
- [x] Bloque 2: `ClienteService.agregarEvidencias` (upsert por tipo, valida ownership y flags) (unit 2 tests).
- [x] Bloque 3: Endpoint cobrador + delegación en `CobradorService` (e2e 2 tests).
- [x] Fix: `limpiarDatos` del e2e cobrador borraba `GastoEvidencia` pero no `ClienteEvidencia` (FK roto preexistente).

## Resultado final
- Comandos ejecutados: `scripts/check.sh` (826 tests) + `npm run test:e2e` (53 suites, 384 tests).
- Archivos modificados:
  - `src/modules/cartera/cliente.service.ts` — `fotoUrl` en `ClientePublic`, `fotosFacialesDeClientes`, `agregarEvidencias`.
  - `src/modules/cartera/cliente.service.spec.ts` — mocks + 3 tests.
  - `src/modules/cobrador/cobrador.service.ts` — `agregarEvidenciasCliente`.
  - `src/modules/cobrador/cobrador.controller.ts` — endpoint evidencias (FileFieldsInterceptor + clienteFotosMulterOptions).
  - `test/e2e/cobrador-apk.e2e-spec.ts` — 2 tests evidencias + fix limpieza ClienteEvidencia + `actualizar_cliente: true`.
  - `test/e2e/mapa-clientes-dia.e2e-spec.ts` — préstamo vigente al cliente "SinDomicilio" (consistente con B4).
  - `docs/ai/tasks/b2-foto-documento-cliente.md` (este archivo).
- Pendientes: reiniciar backend live.