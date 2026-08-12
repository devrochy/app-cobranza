# Tarea: Editar configuración de ruta (9a)

- **Origen:** 9a (docs/plan-feature-roadmap.md:27) — amplía HU-09 (docs/APP_REQUIREMENTS.md:43)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Administrador o un Socio con `configurar_ruta` edite el tipo de interés y el número de cuotas de una ruta existente (`PATCH /rutas/:id/configuracion`). La `moneda` NO es editable (decisión del usuario, evita mezclar monedas en estadísticas/liquidaciones).

## Fuera de alcance
- Editar `moneda` (nunca editable), `cobrador` (ya existe `PATCH /rutas/:id/cobrador`), `estatus` (ya existe), metadata nombre/descripción (HU-09).
- `ruta_config` (HU-10).
- Guards de consistencia con préstamos existentes (no existen préstamos aún; HU-14 — ver backlog `prestamos.tipo_interes`).

## Bloques (checklist TDD)
- [x] Bloque 1: `UpdateRutaConfigDto` (tipoInteres? > 0, numCuotas? >= 1, al menos uno) + `RutasService.actualizarConfiguracion(id, { tipoInteres?, numCuotas? }, requester)` (404, ownership, body vacío 400, cambia solo los campos provistos) + `PATCH /rutas/:id/configuracion` con `@PermisoRequerido("configurar_ruta")`. Tests unitarios.
- [x] Bloque 2: e2e `test/e2e/editar-config-ruta.e2e-spec.ts` (200 interés/cuotas, 400 body vacío, 400 moneda rechazada por forbidNonWhitelisted, 404, 401, 403 ownership).

## Decisiones tomadas durante la implementación
- Endpoint separado `PATCH /rutas/:id/configuracion` (decisión del usuario) — mantiene `PATCH /rutas/:id` como metadata pura y separa la auditoría.
- Gated por `configurar_ruta` + ownership (consistente con metadata/estatus/cobrador).
- `moneda` no editable: garantizado por DTO + forbidNonWhitelisted → 400.
- Cambiar interés/cuotas solo afecta préstamos futuros (ruta = default; el préstamo cierra su tasa — ver backlog).
- Se reutiliza `assertOwned`.

## Ambigüedades resueltas con el usuario
- Pregunta: forma del endpoint → Respuesta: `PATCH /rutas/:id/configuracion` separado.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+156 tests unitarios), `npm run test:e2e` (96 tests, 12 suites).
- Archivos modificados: `src/modules/rutas/rutas.service.ts` (+spec), `rutas.controller.ts` (+spec), `dto/update-ruta-config.dto.ts`, `test/e2e/editar-config-ruta.e2e-spec.ts`, `docs/ai/tasks/editar-config-ruta.md`.
- Pendientes/seguimiento: sin préstamos aún (HU-14), el cambio solo afecta préstamos futuros; cuando HU-14 exista se implementa el guard de consistencia (backlog `prestamos.tipo_interes`). La moneda queda no-editable (verificado con forbidNonWhitelisted → 400).
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: e2e de rangos del DTO (tipoInteres 0, numCuotas 0 → 400) y de la precedencia validación-antiguo-404 (ruta inexistente con body vacío → 400). Notas aceptadas: el 403 por falta de `configurar_ruta` está cubierto transversalmente en `editar-ruta.e2e-spec.ts` (mismo guard+permiso); la fila `socio_permisos` del e2e se limpia por CASCADE al borrar el socio (entidad HU-06). Precedencia documentada: se valida el body (400) antes de la existencia (404).
- **PR:** (a completar al abrirla)
