# Tarea: socio-dashboard (GET /dashboard para rol socio)

- **Origen:** Petición directa del usuario (sesión opencode 2026-09-06) — el panel admin
  redirige al socio a /dashboard, pero `GET /dashboard` es admin-only → 403 → loop.
- **Estado:** completada (pendiente de PR)
- **Fecha inicio:** 2026-09-06

## Objetivo
Permitir que el rol `socio` consuma `GET /dashboard` con su propio dashboard, forzando
`socioId = req.user.sub` e ignorando `rutaId`/`socioId` del query (evita filtrar datos
de otros socios). El rol `admin` conserva el comportamiento actual (filtros del query).

## Fuera de alcance
- `GET /conversaciones-ia/panel` (monitoreo IA) sigue admin-only.
- Otros endpoints del panel (el panel ya maneja el 403 con `forbidden()` en el repo admin).

## Bloques (checklist TDD)

- [ ] Bloque 1: controlador `GET /dashboard` — rol socio fuerza `socioId = sub` y descarta `rutaId`; admin pasa los filtros del query.
  - Test(s): `src/modules/dashboard/dashboard.controller.spec.ts` (nuevo test de socio + ajuste de los tests existentes para pasar `req`).

## Decisiones tomadas durante la implementación
- El servicio ya acepta `socioId` (acota rutas por ownership en `resolverRutaIds`); el
  controlador ahora lo fuerza para rol socio y no confía en el query.
- Se descarta `rutaId` para socio porque `resolverRutaIds` no valida ownership de la ruta.

## Ambigüedades resueltas con el usuario
- (instrucción directa: el socio debe poder entrar a su dashboard)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `npx jest src/modules/dashboard` (13 tests OK). `scripts/check.sh` del backend tiene 1 fallo pre-existente ajeno (`prestamo.service.spec.ts:292`, dependiente de zona horaria) → registrado en `docs/ai/tasks/backlog.md`.
- Archivos modificados: `src/modules/dashboard/dashboard.controller.ts` (+ test en `dashboard.controller.spec.ts`), `docs/ai/tasks/socio-dashboard.md`, `docs/ai/tasks/backlog.md`.
- Pendientes/seguimiento: el test de fechas de cuotas (flaky por TZ) queda en backlog.