# Tarea: listado-cartera

- **Origen:** Petición directa del usuario (panel admin Fase P2 — `docs/plan-panel-admin.md` del repo `app-cobranza-admin`). El módulo cartera no tiene listados en el backend.
- **Estado:** completada
- **Fecha inicio:** 2026-08-27

## Objetivo
El admin (o socio con permiso) obtiene: listado de clientes de una ruta, préstamos de un cliente, cambios de cliente pendientes de aprobación (HU-47), y puede cambiar el estatus de un cliente.

## Fuera de alcance
- Paginación (array plano).
- Listados de pagos/abonos/visitas (se muestran agregados vía estado-cuenta/tarjeta).
- Mapa completo de clientes de la ruta (solo `dia/mapa` existente).

## Bloques (checklist TDD)

- [x] Bloque 1: `GET /rutas/:rutaId/clientes` → `ClientePublic[]` (id ASC) + `PATCH /rutas/:rutaId/clientes/:clienteId/estatus`.
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`, `cartera.controller.spec.ts`, `test/e2e/ampliar-cliente.e2e-spec.ts`.
- [x] Bloque 2: `GET /rutas/:rutaId/clientes/:clienteId/prestamos` → `PrestamoPublic[]` con cuotas (id ASC).
  - Test(s): `src/modules/cartera/prestamo.service.spec.ts`, `cartera.controller.spec.ts`, e2e.
- [x] Bloque 3: `GET /rutas/:rutaId/cambios-cliente?estado=` → `ClienteCambioPublic[]` (createdAt DESC).
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`, e2e.
- Verificación: `scripts/check.sh` + `scripts/test-e2e.sh` (BD arriba).

## Decisiones tomadas durante la implementación
- `Prestamo` no tenía relación a `Cuota`: se agregó `@OneToMany(() => Cuota, (c) => c.prestamo) cuotas` (arrow function diferida resuelve el ciclo de imports; NO es lazy). El listado carga cuotas con `relations` y orden `numeroCuota ASC`.
- Permisos: `GET clientes` y `PATCH estatus` y `GET cambios-cliente` → `configurar_ruta`; `GET prestamos/:clienteId` → `ver_reportes`. Todos con `assertOwned` para socio.
- `GET clientes` no usa DTO de query (sin filtros); `GET cambios-cliente` valida `?estado=` con `ListarCambiosClienteDto` (forbidNonWhitelisted).

## Ambigüedades resueltas con el usuario
- Backend cartera → **Completo** (clientes + préstamos por cliente + cambios-cliente + estatus de cliente).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar:
  - `scripts/check.sh` → OK.
  - `scripts/test-e2e.sh` → OK (341 tests, 49 suites).
- Archivos modificados:
  - `src/modules/cartera/cliente.service.ts` — `listar`, `listarCambios`, `setEstatus`.
  - `src/modules/cartera/prestamo.service.ts` — `listarPorCliente`.
  - `src/modules/cartera/prestamo.entity.ts` — relación `cuotas`.
  - `src/modules/cartera/cartera.controller.ts` — 4 rutas nuevas.
  - `src/modules/cartera/dto/listar-cambios-cliente.dto.ts`, `update-estatus-cliente.dto.ts` (nuevos).
  - Specs unitarios + e2e.
  - `docs/ai/tasks/listado-cartera.md` (este archivo).
- Revisión independiente (code-reviewer): pendiente al momento de este registro.
- Pendientes/seguimiento: al aterrizar el PR, el panel (B2 de `gestion-cartera`) consume estos listados.