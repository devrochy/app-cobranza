# Tarea: Ampliar registro de cliente y préstamo (dos direcciones, fotos, tope deuda, fecha ±30 días, fiador) (amplía HU-14)

- **Origen:** Roadmap Fase 1 ítem 10 (docs/plan-feature-roadmap.md:28) — HU-14 (docs/APP_REQUIREMENTS.md:57). Tablas PRD 4.2:285 (clientes), 289 (prestamos), 307 (cliente_evidencias), 276 (ruta_config).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-18

## Objetivo
Ampliar el registro de cliente (dos direcciones, fotos facial/documento por flags de ruta, tope de deuda) y de préstamo (fiador opcional, fecha ±30 días gateada por flag, validación de tope de deuda del cliente) según HU-14.

## Fuera de alcance
- Actualización de cliente con flujo de aprobación (HU-47, ítem 11).
- Reconocimiento facial real (validación biométrica) — solo captura de foto por flag.
- Lista de clientes del día / tarjeta (HU-56/58) y navegación (HU-59).
- Servir/descargar la foto del cliente (endpoint GET) — solo se persiste.
- Login del cobrador y sus permisos (registrar_prestamo de cobrador).

## Decisiones tomadas durante la implementación
- Tope de deuda: **validar tope deuda del cliente + cupo de ruta** al crear préstamo (409 si excede).
- Fotos: **subir en disco local** (uploads/clientes, multer) + flags de obligatoriedad (`reconocimiento_facial_activo` → foto facial; `registro_documento_cliente` → foto documento).
- Fecha préstamo: **validar ±30 días** + flag `permitir_cambio_fecha_prestamo`.
- Flag `registro_documento_cliente`: **agregarlo a ruta_config** (default false).
- Gating: **permitir a socios con `configurar_ruta`** + ownership.

## Bloques (checklist TDD)
- [x] Bloque 0: Agregar `registroDocumentoCliente` a `ruta_config` (entity, defaults, public, DTO de matriz).
  - Test(s): `ruta-config.service.spec.ts`
- [x] Bloque 1: `Cliente` entity: `topeMaximoDeuda` + `ubicacionDomicilio` (geography nullable); `CreateClienteDto`/`ClientePublic` con los nuevos campos opcionales.
  - Test(s): `cliente.service.spec.ts`
- [x] Bloque 2: Entidad `ClienteEvidencia` + subida en disco (uploads/clientes) + flags de obligatoriedad.
  - Test(s): `cliente.service.spec.ts`, `cartera.controller.spec.ts`
- [x] Bloque 3: `Prestamo` entity: fiador (nombre/apellido/documento/telefono, nullable); `CreatePrestamoDto`/`PrestamoService`: fecha ±30 días (flag) + tope deuda del cliente (409).
  - Test(s): `prestamo.service.spec.ts`
- [x] Bloque 4: Gating `configurar_ruta` en endpoints de cliente/préstamo; e2e.
  - Test(s): `cartera.controller.spec.ts`, `test/e2e/ampliar-cliente.e2e-spec.ts`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿tope de deuda? → **validar tope deuda + cupo**.
- Pregunta: ¿fotos? → **subir en disco + flags de obligatoriedad**.
- Pregunta: ¿fecha ±30 días? → **validar ±30 + flag permitir_cambio_fecha_prestamo**.
- Pregunta: ¿flag registro_documento_cliente? → **agregarlo a ruta_config**.
- Pregunta: ¿gating? → **permitir a socios con configurar_ruta**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 307 tests) y `npm run test:e2e` (21 suites, 171 tests) en verde.
- Archivos modificados: `src/modules/cartera/cliente.entity.ts`, `cliente.service.ts` (+spec), `cliente-evidencia.entity.ts`, `cliente-foto-upload.ts`, `prestamo.entity.ts`, `prestamo.service.ts` (+spec), `cartera.controller.ts` (+spec), `cartera.module.ts`, `dto/create-cliente.dto.ts`, `dto/create-prestamo.dto.ts`, `src/modules/rutas/ruta-config.entity.ts`, `ruta-config.service.ts` (+spec), `dto/update-ruta-config-matrix.dto.ts`, `test/e2e/ampliar-cliente.e2e-spec.ts`, `.env.example` (+UPLOAD_DIR_CLIENTES), `docs/ai/tasks/backlog.md`, `docs/ai/tasks/ampliar-registro-cliente.md`.
- **Revisión final (code-reviewer, 2026-08-18):** APROBADO CON OBSERVACIONES. Atendidas: fecha relativa en tests de prestamo (evita bomba de tiempo en CI); `assertOwned` compartido reutilizado en `cliente.service` y `prestamo.service` (elimina duplicación §5); `numericTransformer` común en `prestamo.entity`; cliente+evidencias envueltos en `dataSource.transaction`; `@Min/@Max` en lat/lng del DTO; `configDefault` reemplazado por `RutaConfigDefaults`; `saldoVigente` calculado una sola vez. Registradas en backlog: semántica del tope de deuda (mezcla de interés), duplicación del patrón de upload, endpoint de descarga de foto, cobertura e2e de autorización/flags.
- Pendientes/seguimiento: actualización de cliente con flujo de aprobación (HU-47, ítem 11); endpoint de descarga de foto del cliente (backlog); reconocimiento facial real (Fase 2); lista del día (HU-56/58); login del cobrador. **Pendiente commit + PR.**
