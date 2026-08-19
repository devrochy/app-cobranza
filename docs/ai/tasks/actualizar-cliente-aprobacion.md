# Tarea: Actualización de cliente con flujo de aprobación (HU-47)

- **Origen:** Roadmap Fase 1 ítem 11 (docs/plan-feature-roadmap.md:29) — HU-47 (docs/APP_REQUIREMENTS.md:64). Tabla PRD 4.2:326 (cambios_cliente_pendientes).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-18

## Objetivo
Actualizar los datos básicos de un cliente (nombre, apellido, negocio, teléfono, ubicaciones) con flujo de aprobación: quien tenga `actualizar_cliente` aplica directo; quien no (y el cobrador futuro) genera una propuesta pendiente que un Admin o Socio dueño con permiso aprueba/rechaza con auditoría.

## Fuera de alcance
- Notificación al socio cuando hay propuesta pendiente (Fase 4, WhatsApp).
- Actualización de `topeMaximoDeuda` y fotos del cliente (solo datos básicos).
- Auditoría imborrable de otras entidades (HU-48, ítem 12).
- Login del cobrador y su invocación real de la propuesta.
- Endpoint de descarga de foto de cliente (backlog).

## Decisiones tomadas durante la implementación
- Actores: **Socio/Admin; cobrador futuro** (se modela la tabla y el flujo completo aunque no haya login de cobrador).
- Permiso: **`actualizar_cliente`** (ya en SOCIO_PERMISOS); **agregar `actualizar_cliente` a COBRADOR_PERMISOS** (PRD 4.2:264).
- Campos: **solo datos básicos del PRD** (nombre, apellido, negocio, telefonoWhatsapp, ubicaciones).
- Quién aprueba: **Admin o socio dueño con `actualizar_cliente`** + ownership; `motivo_rechazo` si rechaza; sin notificación externa en MVP.
- Endpoints: **PATCH /rutas/:rutaId/clientes/:clienteId** (actualizar) y **PATCH /rutas/:rutaId/cambios-cliente/:cambioId/decision** (aprobar/rechazar).
- Al aprobar: **aplica cambios al cliente + marca aprobado** (misma transacción).
- Propuestas: **permitir varias pendientes** por cliente.

## Bloques (checklist TDD)
- [x] Bloque 0: Agregar `actualizar_cliente` a `COBRADOR_PERMISOS` (+ specs de permisos).
- [x] Bloque 1: Entidad `CambioClientePendiente` (PRD 4.2:326) + registro en módulo.
- [x] Bloque 2: `ClienteService.actualizar` — validaciones (ruta/cliente/ownership); con `actualizar_cliente` aplica directo, si no crea propuesta pendiente. Campos básicos.
  - Test(s): `cliente.service.spec.ts`
- [x] Bloque 3: `ClienteService.decidirPropuesta` — Admin o socio dueño con `actualizar_cliente` aprueba (aplica cambios) o rechaza (motivo_rechazo), registrando revisado_por/revisado_en.
  - Test(s): `cliente.service.spec.ts`
- [x] Bloque 4: Endpoints PATCH cliente + PATCH decisión; e2e.
  - Test(s): `cartera.controller.spec.ts`, `test/e2e/actualizar-cliente.e2e-spec.ts`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿actores del flujo en MVP? → **Socio/Admin; cobrador futuro**.
- Pregunta: ¿permiso? → **actualizar_cliente en ambos enums**.
- Pregunta: ¿campos editables? → **solo datos básicos del PRD**.
- Pregunta: ¿quién aprueba? → **Admin o socio dueño con actualizar_cliente**.
- Pregunta: ¿endpoints? → **PATCH cliente + PATCH decisión**.
- Pregunta: ¿al aprobar? → **aplica cambios + marca aprobado**.
- Pregunta: ¿propuestas múltiples? → **permitir varias pendientes**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + tests) y `npm run test:e2e` (22 suites, 174 tests) en verde.
- Archivos modificados: `src/modules/cartera/cambio-cliente-pendiente.entity.ts`, `cliente.service.ts` (+spec), `cartera.controller.ts` (+spec), `cartera.module.ts`, `dto/actualizar-cliente.dto.ts`, `dto/decision-cambio.dto.ts`, `src/modules/cobradores/cobrador-permiso.entity.ts` (+actualizar_cliente), `cobradores-permisos.service.spec.ts`, `test/e2e/actualizar-cliente.e2e-spec.ts`, `docs/ai/tasks/backlog.md`, `docs/ai/tasks/actualizar-cliente-aprobacion.md`.
- **Revisión final (code-reviewer, 2026-08-18):** APROBADO CON OBSERVACIONES. Atendidas: 400 si body vacío, `@IsNotEmpty` en nombre/apellido, tests de 404 (cliente/propuesta), 403 ownership, 400 propuesta ya decidida y "varias pendientes permitidas"; nombre de test "12 permisos" corregido. Registrada en backlog: race TOCTOU en `decidirPropuesta` (mitigar con UPDATE condicional o versión).
- Pendientes/seguimiento: notificación al socio cuando hay propuesta pendiente (Fase 4); actualización de topeMaximoDeuda y fotos (backlog); auditoría imborrable de otras entidades (HU-48, ítem 12); login del cobrador (el permiso `actualizar_cliente` del cobrador es hoy inalcanzable por el PermisoGuard). **Pendiente commit + PR.**
