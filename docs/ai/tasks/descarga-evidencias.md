---
estado: completada
tags: [tarea]
---

# Tarea: Descarga autenticada de evidencias (gastos y clientes)

- **Origen:** Petición directa del usuario (2026-09-11) — pendiente #1 del backlog (hueco cross-repo: las evidencias solo se sirven por `/uploads/*` estático sin auth).
- **Estado:** completada
- **Fecha inicio:** 2026-09-11

## Objetivo
Exponer endpoints autenticados que devuelvan (streaming) la evidencia de un gasto y la foto/documento de un cliente, validando permisos y ownership, con `Content-Type` correcto, `Content-Disposition` inline/attachment y protección anti path-traversal; y dejar de filtrar la ruta absoluta del filesystem en el contrato público.

## Fuera de alcance
- APK (mostrar/descargar evidencias con auth) — Fase 3.
- Dejar de servir `/uploads/*` público — Fase 4.
- Borrado de archivos huérfanos.

## Bloques (checklist TDD)
- [x] Bloque 1: helper `prepararDescargaEvidencia` arma headers seguros y rechaza traversal/falta de archivo (unit).
  - Test(s): `src/common/descarga-archivo.spec.ts`
- [x] Bloque 2: `GastosService.descargarEvidencia` valida ownership y devuelve la evidencia del gasto (unit).
  - Test(s): `src/modules/rutas/gastos.service.spec.ts`
- [x] Bloque 3: `evidenciaToPublic` normaliza `rutaArchivo` con `urlArchivoServible` (unit).
  - Test(s): `src/modules/rutas/gastos.service.spec.ts`
- [x] Bloque 4: `ClienteTarjetaService.descargarEvidencia` valida ownership, tipo y cliente (unit).
  - Test(s): `src/modules/cartera/cliente-tarjeta.service.spec.ts`
- [x] Bloque 5: endpoints HTTP `GET /rutas/:id/gastos/:gastoId/evidencias/:evidenciaId` y `GET /rutas/:rutaId/clientes/:clienteId/evidencias/:tipo` (e2e: 200 + headers, 401, 403, 404).
  - Test(s): `test/e2e/descarga-evidencias.e2e-spec.ts`

## Decisiones tomadas durante la implementación
- Cliente se identifica por `tipo` (`foto_facial|documento_frente|documento_reverso`); gasto por `evidenciaId`.
- Respuesta `inline` por defecto y `attachment` con `?descargar=1`.
- Panel consume directo por `/api/backend/...` (el proxy inyecta el Bearer); no requiere route handlers nuevos.
- `EvidenciaArchivo` vive en `src/common/descarga-archivo.ts` (compartido por ambos servicios).
- El helper rechaza symlinks que escapan del base y directorios (`realpath` + `isFile`), y codifica `filename*` según RFC 5987.
- Un gasto soft-eliminado conserva su evidencia descargable (trazabilidad/auditoría); el panel no la enlaza (solo lista gastos activos).

## Ambigüedades resueltas con el usuario
- Pregunta: alcance ahora → Respuesta: Backend + Panel (diferir APK y quitar `/uploads` público).
- Pregunta: tipo de respuesta → Respuesta: inline + `?descargar=1`.
- Pregunta: clave del endpoint de cliente → Respuesta: por `tipo`.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (107 suites, 949 tests) + `npm run test:e2e` (55 suites, 403 tests) → verde.
- Archivos modificados:
  - `src/common/descarga-archivo.ts` (+ `.spec.ts`, 8 tests) — helper de descarga segura (anti traversal/symlink/directorio), `pideDescarga` y saneo de nombre.
  - `src/modules/rutas/gastos.service.ts` (+ `.spec.ts`) — `descargarEvidencia`, `EvidenciaArchivo` compartido y normalización de `rutaArchivo`.
  - `src/modules/rutas/rutas.controller.ts` — endpoint `GET /rutas/:id/gastos/:gastoId/evidencias/:evidenciaId`.
  - `src/modules/cartera/cliente-evidencia.entity.ts` — `esTipoEvidenciaCliente`.
  - `src/modules/cartera/cliente-tarjeta.service.ts` (+ `.spec.ts`) — `descargarEvidencia` por tipo.
  - `src/modules/cartera/cartera.controller.ts` — endpoint `GET /rutas/:rutaId/clientes/:clienteId/evidencias/:tipo`.
  - `test/e2e/descarga-evidencias.e2e-spec.ts` — 8 tests (200 inline/attachment, 401 gasto/cliente, 403 sin permiso, 404 inexistente/tipo inválido).
  - `src/modules/cartera/prestamo.service.spec.ts` — fix del time-bomb de fecha (2026-08-12 + 30 días) con `jest.useFakeTimers`/`setSystemTime`.
- Pendientes/seguimiento: Fase 3 (APK) y Fase 4 (dejar de servir `/uploads/*` público).
