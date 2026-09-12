---
estado: completada
tags: [tarea]
---

# Tarea: P0.4 — Evidencias huérfanas al fallar la operación

- **Origen:** Petición directa del usuario (2026-09-12) — workstream **P0 Robustez+seguridad**; ítem del backlog: "Archivos huérfanos de evidencias ante fallo posterior al upload".
- **Estado:** completada
- **Fecha inicio:** 2026-09-12

## Objetivo
Borrar del disco las evidencias/fotos que multer ya escribió cuando la operación que las referencia falla (ruta inexistente, ownership, validaciones del servicio o fallo de la transacción), para no dejar archivos sin registro en la BD.

## Fuera de alcance
- Fallos ANTERIORES al servicio (validación del DTO por `ValidationPipe`, guards): multer escribe los archivos antes del pipe; cubrirlos requiere un interceptor/filtro global (se documenta como seguimiento).
- Borrado del archivo anterior al reemplazar una evidencia en `agregarEvidencias` (leak preexistente, distinto ítem).

## Bloques (checklist TDD)
- [x] Bloque 1: helper `eliminarArchivosSubidos(paths)` (best-effort, ignora `ENOENT`).
  - Test(s): `src/common/archivos.spec.ts`
- [x] Bloque 2: `GastosService.registrar` limpia las evidencias si falla la transacción.
  - Test(s): `src/modules/rutas/gastos.service.spec.ts`
- [x] Bloque 3: `ClienteService.crear` y `agregarEvidencias` limpian las fotos si la operación falla.
  - Test(s): `src/modules/cartera/cliente.service.spec.ts`

## Decisiones tomadas durante la implementación
- Limpieza a nivel de servicio (try/catch / `.catch` de la transacción) en lugar de un interceptor global: evita borrar archivos ya referenciados si un error ocurre DESPUÉS del commit.
- El helper deduplica rutas y tolera valores vacíos/inexistentes.

## Ambigüedades resueltas con el usuario
- (ninguna)

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `bash scripts/check.sh` (108 suites, 972 tests) + `npm run test:e2e` (58 suites, 411 tests) → verde.
- Archivos modificados:
  - `src/common/archivos.ts` (+ `.spec.ts`) — `eliminarArchivosSubidos`.
  - `src/modules/rutas/gastos.service.ts` (+ `.spec.ts`) — limpia evidencias si falla el registro.
  - `src/modules/cartera/cliente.service.ts` (+ `.spec.ts`) — limpia fotos si falla `crear`/`agregarEvidencias`.
- Pendientes/seguimiento: fallos previos al servicio (DTO/guards) no limpian; evaluar un interceptor global de uploads en un ítem futuro. El reemplazo de una evidencia no borra el archivo anterior.
