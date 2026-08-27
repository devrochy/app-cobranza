# Tarea: estado-cuenta-cuota-id

- **Origen:** Petición del usuario (panel admin `app-cobranza-admin`, bloque 6 de `gestion-cartera`): el estado de cuenta no expone el id de entidad de la cuota, pero `POST /rutas/:rutaId/pagos` y la visita `tipoPago: "cuota"` lo exigen.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-27

## Objetivo
`GET /rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` devuelve cada cuota con su id de entidad (`cuotaId`), permitiendo al panel registrar pagos específicos de cuota (`POST /pagos`) y visitas `tipoPago: "cuota"`.

## Fuera de alcance
- `PrestamoPublic.cuotas` (`GET clientes/:clienteId/prestamos`): se deja sin `cuotaId` — la respuesta de `POST /prestamos` genera cuotas antes de persistir (sin id), sería inconsistente. El panel no lo necesita. → backlog.
- Cambios en el panel (`app-cobranza-admin`): ya tipado (`cuotaId?: number`) y preparado; no requiere cambios.

## Bloques (checklist TDD)

- [x] Bloque 1: dominio `construirEstadoCuentaPrestamo` propaga `cuotaId` en `CuotaEstadoInput`/`CuotaEstado`.
  - **Hecho (2026-08-27):** `CuotaEstadoInput`/`CuotaEstado` con `cuotaId: number`; `construirEstadoCuentaPrestamo` lo propaga. Spec actualizado (helper `cuota()` con `cuotaId` + assert `expect.any(Number)`).
  - Test(s): `src/domain/estado-cuenta-prestamo.spec.ts`.
- [x] Bloque 2: `estado-cuenta.service.ts` incluye `cuotaId: c.id` al construir el estado de cuenta.
  - **Hecho (2026-08-27):** mapeo con `cuotaId: c.id`; también `asistente-ia.service.ts` (mismo builder interno). Spec actualizado (mocks con `id` + `expect(result.cuotas.map(c => c.cuotaId)).toEqual([11,12,13])`).
  - Test(s): `src/modules/cartera/estado-cuenta.service.spec.ts`.
- [ ] Bloque 3 (opcional): caso e2e de estado de cuenta con `cuotaId`.
  - **Parcial (2026-08-27):** aserción `toHaveProperty("cuotaId")` añadida en `test/e2e/estado-cuenta-envio-reporte.e2e-spec.ts`, pero **no ejecutada** (BD Postgres/PostGIS no disponible en el entorno; `scripts/test-e2e.sh` requiere `docker compose up -d`).

## Decisiones tomadas durante la implementación
- Campo público: `cuotaId` (consistente con los paths del controller y con el panel admin).
- `CuotaEstadoInput`/`CuotaEstado` del dominio pasan a requerir `cuotaId: number` (siempre existe en la entidad persistida).

## Ambigüedades resueltas con el usuario
- Nombre del campo → `cuotaId`.
- Ejecución del cambio → en esta sesión (repo backend `app-cobranza`), documentando en `docs/ai/tasks/estado-cuenta-cuota-id.md` y actualizando la dependencia en el repo del panel.

## Resultado final
- Comandos ejecutados para verificar:
  - `scripts/check.sh` → OK (722 tests, 85 suites). Lint + typecheck + tests unitarios.
  - `scripts/test-e2e.sh` → **no ejecutado** (BD caída: Docker/colima no disponible). La aserción e2e de `cuotaId` queda para correr cuando la BD esté arriba.
- Archivos modificados:
  - `src/domain/estado-cuenta-prestamo.ts` — `CuotaEstadoInput`/`CuotaEstado` con `cuotaId`; propagación en `construirEstadoCuentaPrestamo`.
  - `src/modules/cartera/estado-cuenta.service.ts` — `cuotaId: c.id` en `construirEstado`.
  - `src/modules/cartera/asistente-ia.service.ts` — `cuotaId: c.id` en `estadoDePrestamo`.
  - Specs: `estado-cuenta-prestamo.spec.ts`, `estado-cuenta.service.spec.ts`, `test/e2e/estado-cuenta-envio-reporte.e2e-spec.ts`.
  - `docs/ai/tasks/estado-cuenta-cuota-id.md`.
- Pendientes/seguimiento:
  - Correr el e2e cuando la BD esté disponible.
  - Merge del PR de esta rama a `develop`; luego el panel (`app-cobranza-admin`) queda funcional para pago de cuota sin cambios.
  - `PrestamoPublic.cuotas` sin `cuotaId` (decisión documentada; backlog).