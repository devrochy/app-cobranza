# Tarea: Registrar pago de cuota y abono con método de pago, actualizando caja (HU-15)

- **Origen:** Roadmap Fase 1 ítem 7 (docs/plan-feature-roadmap.md:25) — HU-15 (docs/APP_REQUIREMENTS.md:58). Tablas PRD 4.2:296,298; nota PRD 4.3:366.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Registrar el pago de una cuota o un abono parcial de un cliente con método de pago obligatorio (enum global fijo), actualizando la caja de la ruta de forma transaccional.

## Fuera de alcance
- Entidad Visita y registro de visita con resultado/motivos (HU-46, ítem 8).
- Motivos de no pago (HU-16) y promesa de pago.
- Auditoría imborrable de edición/eliminación (HU-48, ítem 12).
- `metodos_pago` configurable por ruta en ruta_config (HU-10).
- Login del cobrador y sus permisos (registrar_pago/registrar_abono de cobrador).

## Decisiones tomadas durante la implementación
- Entidades `Pago` y `Abono` con `visita_id` nullable (sin entidad Visita aún); el registro de visita llega en HU-46.
- Método de pago: **enum global fijo** (`efectivo/qr/transferencia/tarjeta/deposito`), sin metodos_pago por ruta.
- Gating: **permitir a socios con `configurar_ruta`** + `assertOwned` (no hay login de cobrador).
- Caja: **transaccional** con el pago/abono (`dataSource.transaction`).
- **Pago de cuota**: el valor debe **coincidir exactamente con `valorEsperado`** de la cuota; si difiere → 400. La cuota pasa a `pagada`.
- **Abono**: **acumulado al préstamo** (suma de abonos) sin cambiar el estatus de cuotas individuales; el saldo pendiente = total de cuotas pendientes/atrasadas − abonos acumulados.
- El abono no debe superar la deuda pendiente del préstamo (validación).
- `registrado_por` guarda `requester.sub` (id de admin/socio); desviación del PRD 4.2 que lo define como `cobrador_id o ia` — no hay login de cobrador aún (decisión documentada).
- Concurrencia (MVP local, sin locks/idempotencia): el abono calcula deuda fuera de transacción y el pago chequea `estatus` fuera de transacción; `caja.saldoActual` se actualiza sin lock (lost update potencial). Se registra en backlog, no se bloquea en esta iteración.
- El abono que iguala la deuda deja el préstamo `vigente` con cuotas pendientes; la transición a `liquidado` se evalúa en HU-46 (ítem 8) / liquidación HU-20 (queda en seguimiento).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidades `Pago` y `Abono` + enum `MetodoPago` (src/domain) + registro en módulo.
  - Test(s): `src/domain/metodo-pago.spec.ts`
- [x] Bloque 2: `PagosService.registrarPagoDeCuota` — 404 ruta/cuota, ownership, validar cuota pendiente/atrasada, valor == valorEsperado (400 si difiere), marcar cuota pagada + aplicar caja transaccionalmente.
  - Test(s): `src/modules/cartera/pagos.service.spec.ts`
- [x] Bloque 3: `AbonosService.registrarAbono` — 404 ruta/préstamo, ownership, validar deuda pendiente, no excederla, registrar abono + aplicar caja transaccionalmente.
  - Test(s): `src/modules/cartera/abonos.service.spec.ts`
- [x] Bloque 4: Endpoints `POST /rutas/:rutaId/pagos` y `POST /rutas/:rutaId/abonos` gated por `configurar_ruta` + ownership.
  - Test(s): `cartera.controller.spec.ts`, `test/e2e/pagos-abonos.e2e-spec.ts`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿crear Visita en este ítem? → **Solo Pago y Abono**, sin Visita.
- Pregunta: ¿métodos de pago? → **Enum global fijo**.
- Pregunta: ¿quién accede? → **Permitir a socios con `configurar_ruta`**.
- Pregunta: ¿wiring de caja? → **Transaccional** con el pago/abono.
- Pregunta: ¿valor del pago de cuota? → **Debe coincidir con valorEsperado** (400 si difiere).
- Pregunta: ¿cómo aplicar abono? → **Acumulado al préstamo** (sin tocar estatus de cuotas).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 260 tests) y `npm run test:e2e` (18 suites, 155 tests) en verde.
- Archivos modificados: `src/domain/metodo-pago.ts` (+spec), `src/modules/cartera/pago.entity.ts`, `abono.entity.ts`, `pagos.service.ts` (+spec), `abonos.service.ts` (+spec), `cartera.controller.ts` (+spec), `cartera.module.ts`, `dto/registrar-pago.dto.ts`, `dto/registrar-abono.dto.ts`, `src/modules/rutas/caja.service.ts` (+TipoMovimientoCaja PAGO/ABONO y manager en aplicarMovimiento), `test/e2e/pagos-abonos.e2e-spec.ts`, `docs/ai/tasks/backlog.md`, `docs/ai/tasks/registrar-pago-abono.md`.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Atendidas: reutilizar `assertOwned` en PagosService y AbonosService (elimina duplicación §5), eliminar repos inyectados sin uso (clienteRepo/prestamoRepo), renombrar test "409"→400, agregar aserción de `aplicarMovimiento` en los tests de transacción, agregar e2e de 403 socio sin permiso y de abono que excede deuda. Documentadas en tarea/backlog: desviación `registrado_por`, concurrencia sin lock, abono-igual-deuda (estado huérfano), `esMetodoPagoValido` sin uso.
- Pendientes/seguimiento: entidad Visita y registro de visita (HU-46, ítem 8); motivos de no pago (HU-16); auditoría de edición/eliminación (HU-48, ítem 12); wiring de color de riesgo (HU-13) tras pago/abono; concurrencia/lock en caja (backlog). **Pendiente commit + PR.**
