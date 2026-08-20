# Tarea: Lista de clientes del día con colores (HU-56)

- **Origen:** Roadmap Fase 3 ítem 18 (docs/plan-feature-roadmap.md:42) — HU-56 (docs/APP_REQUIREMENTS.md:106), amplía HU-13.
- **Estado:** completada
- **Fecha inicio:** 2026-08-19

## Objetivo
Endpoint `GET /rutas/:id/dia/clientes` (gated `ver_reportes`) que devuelve la lista de clientes del día (snapshot = trayecto planificado de `ruta_optimizada_log` del ítem 17) con color verde/rojo/blanco, incluyendo clientes con deuda (en trayectos) y clientes al día/pago anticipado (aparecen pero NO en trayectos), recalculado en vivo desde las visitas registradas.

## Fuera de alcance
- Tarjeta de cliente completa (foto, tipo de pago, saldo, mora detallada) → HU-58 (ítem 20).
- Mapa de clientes con markers → HU-57 (ítem 19).
- Navegación al cliente → HU-59 (ítem 21).
- Persistencia de snapshot mutable / eventos y notificaciones → Fase 4.
- Wiring persistido del color de riesgo (HU-13) en `clientes.colorRiesgo` (backlog).

## Decisiones tomadas durante la implementación
- Paleta HU-56: mapear HU-13 (azul→verde, rojo→rojo, blanco→blanco) SOLO en la lista del día; HU-13 intacta.
- Snapshot del día = `ruta_optimizada_log` (trayecto planificado, ítem 17).
- Actualización en vivo desde visitas (sin eventos/notificaciones, Fase 4).
- Lista completa: clientes con deuda (en trayectos) + clientes al día/pago anticipado (no en trayectos).
- Color calculado EN VIVO desde el atraso de cuotas (no se depende del wiring persistido de HU-13, que está pendiente).

## Bloques (checklist TDD)
- [x] Bloque 0: Función pura `colorListaDelDia` (mapeo HU-13 → verde/rojo/blanco; blanco > verde-visita-pago > rojo/verde). 7 tests.
- [x] Bloque 1: `ListaClientesDelDiaService.obtener` — lista completa con `enTrayecto` (desde trayecto planificado), `color` y estado en vivo (visitas de hoy). 4 tests unitarios.
- [x] Bloque 2: Endpoint `GET /rutas/:id/dia/clientes` (ver_reportes) + e2e (4 tests).
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: paleta → **mapear azul→verde solo en lista del día**.
- Pregunta: snapshot → **usar ruta_optimizada_log (trayecto planificado)**.
- Pregunta: actualización → **recalcular en vivo desde visitas**.
- Pregunta: alcance → **lista completa (deuda + al día)**.

## Resultado final
- Comandos ejecutados para verificar:
  - `./scripts/check.sh` → lint + typecheck + tests unitarios OK.
  - `npm run test:e2e` → OK (incluye `lista-clientes-dia.e2e-spec.ts`, 4 tests).
- Archivos modificados:
  - `src/domain/lista-clientes-dia.ts` (+spec) — `COLOR_LISTA_DIA`, `colorListaDelDia`.
  - `src/modules/rutas/lista-clientes-dia.service.ts` (+spec) — `obtener`, `listarClientesConEstado` (atraso por cuotas vencidas + esNuevo), `clientesConVisitaPagoHoy`.
  - `src/modules/rutas/rutas.controller.ts` (+spec) — `GET /rutas/:id/dia/clientes` gated por `ver_reportes`.
  - `src/modules/rutas/rutas.module.ts` — registro.
  - `test/e2e/lista-clientes-dia.e2e-spec.ts` (nuevo).
  - `docs/ai/tasks/lista-clientes-dia.md` (este archivo).
- Decisiones de implementación:
  - Color calculado EN VIVO desde el atraso de cuotas (no se lee `cliente.colorRiesgo`, wiring HU-13 pendiente).
  - `esNuevo` = cliente sin cuotas vigentes (sin préstamos o con préstamos no vigentes); se normaliza de boolean/string de Postgres.
  - La lista recorre TODOS los clientes activos de la ruta; `enTrayecto` indica si están en el trayecto planificado.
- Revisión independiente (code-reviewer, 2026-08-19): **APROBADO CON OBSERVACIONES** (sin bloqueantes). Atendidas: (a) simplificado `COALESCE(nombre, apellido)` → `nombre || ' ' || apellido` (apellido es NOT NULL); (b) e2e ampliado con cliente de préstamo liquidado → tratado como esNuevo/blanco (valida el filtro `p.estatus='vigente'`). Nit documentado sin cambio: test unitario de la query SQL de `listarClientesConEstado` (cubierto indirectamente por e2e), test del umbral default sin ruta_config, visita no_pago.
- Pendientes/seguimiento:
  - Tarjeta de cliente completa (HU-58 → ítem 20).
  - Mapa de clientes (HU-57 → ítem 19).
  - Persistir snapshot mutable / eventos (Fase 4).
  - Wiring persistido del color de riesgo (HU-13) en `clientes.colorRiesgo` (backlog).