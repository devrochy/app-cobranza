# Tarea: Editar nombre y descripción de ruta (HU-09)

- **Origen:** HU-09 (docs/APP_REQUIREMENTS.md:43)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Administrador o un Socio con `configurar_ruta` edite el nombre y la descripción de una ruta existente (`PATCH /rutas/:id`), **sin alterar su configuración operativa** (cobrador, tipo de interés, número de cuotas, moneda, estatus).

## Fuera de alcance
- Editar `tipoInteres`, `numCuotas`, `moneda` o `cobrador` (van en una HU de configuración aparte; la `moneda` NO es editable por decisión del usuario).
- `ruta_config` (HU-10).

## Bloques (checklist TDD)
- [x] Bloque 1: `UpdateRutaDto` (nombre requerido + descripcion opcional) + `RutasService.actualizarInformacion(id, { nombre, descripcion? }, requester)` (404, ownership, cambia solo nombre/descripcion) + `PATCH /rutas/:id` con `@PermisoRequerido("configurar_ruta")`. Tests unitarios.
- [x] Bloque 2: e2e `test/e2e/editar-ruta.e2e-spec.ts` (200 renombra + descripción sin alterar config, 404, 400, 401, 403 ownership).

## Decisiones tomadas durante la implementación
- `PATCH /rutas/:id` edita nombre + descripción (metadata) — decisión del usuario.
- La edición de configuración (interés/num_cuotas) va en una HU aparte; la `moneda` queda no-editable (evita mezclar monedas en estadísticas/liquidaciones).
- Gated por `configurar_ruta` + ownership (consistente con HU-08).
- Se reutiliza `assertOwned` del servicio.

## Ambigüedades resueltas con el usuario
- Pregunta: quién edita el nombre → Respuesta: `configurar_ruta` + ownership.
- Pregunta: editar descripción → Respuesta: sí, incluir en HU-09.
- Pregunta: campos centrales → Respuesta: HU aparte para interés/cuotas; moneda no editable.
- Modelo de dominio: ruta = defaults para crear préstamos; el préstamo cierra su propia tasa/cuotas (desviación `prestamos.tipo_interes` para HU-14).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+149 tests unitarios), `npm run test:e2e` (86 tests, 11 suites).
- Archivos modificados: `src/modules/rutas/rutas.service.ts` (+spec), `rutas.controller.ts` (+spec), `dto/update-ruta.dto.ts`, `test/e2e/editar-ruta.e2e-spec.ts`, `docs/plan-feature-roadmap.md`, `docs/ai/tasks/backlog.md`, `docs/ai/tasks/editar-nombre-ruta.md`.
- Pendientes/seguimiento: la edición de configuración de ruta (tipoInteres, numCuotas) va en una HU nueva registrada en el roadmap; la `moneda` NO es editable (decisión). `prestamos.tipo_interes` es una desviación del PRD 4.2 registrada en backlog para HU-14 (el préstamo cierra su propia tasa; las cuotas se validan contra el préstamo, no contra la ruta).
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: se permite **limpiar la descripción** (`descripcion: null`); e2e de 403 por permiso faltante (`configurar_ruta`), de `forbidNonWhitelisted` (tipoInteres → 400) y de descripción `null`; test de servicio renombrado y caso de limpieza añadido. Decisión documentada: la edición de metadata está permitida aunque el socio/cobrador de la ruta esté bloqueado (razonable para metadata; el servicio no valida estatus en `actualizarInformacion`, a diferencia de `create`).
- **PR:** (a completar al abrirla)
