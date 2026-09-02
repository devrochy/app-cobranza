# Tarea: B4 — Lista del día solo con clientes de préstamo vigente

- **Origen:** Plan consolidado aprobado por el usuario 2026-09-02 (Epic B4).
- **Estado:** completada
- **Fecha inicio:** 2026-09-02

## Objetivo
La lista de clientes del día (`ListaClientesDelDiaService.listarClientesConEstado`) debe excluir a los clientes sin préstamo vigente. Antes usaba LEFT JOIN y marcaba `esNuevo` (blanco) a quienes no tenían cuotas; ahora solo aparecen clientes con préstamo `vigente`.

## Fuera de alcance
- Cambiar `colorListaDelDia` (el dominio conserva la rama "blanco" para futuros usos).
- Trayectos/recálculo dinámico.

## Bloques (checklist TDD)
- [x] Bloque 1: Cambiar LEFT JOIN por INNER JOIN de `prestamos` con `estatus='vigente'` en `listarClientesConEstado`.
- [x] Bloque 2: e2e `lista-clientes-dia.e2e-spec.ts` — solo el cliente con préstamo vigente aparece; sin préstamo y liquidado NO.
- [x] Bloque 3: unit `lista-clientes-dia.service.spec.ts` — sin cliente "nuevo" en el fixture.

## Resultado final
- Comandos ejecutados: `scripts/check.sh` (823 tests) + `npm run test:e2e -- lista-clientes-dia` (4 tests).
- Archivos modificados: `src/modules/rutas/lista-clientes-dia.service.ts`, `src/modules/rutas/lista-clientes-dia.service.spec.ts`, `test/e2e/lista-clientes-dia.e2e-spec.ts`, `docs/ai/tasks/b4-lista-dia-prestamo-vigente.md`.
- Pendientes: reiniciar backend live para aplicar el filtro.