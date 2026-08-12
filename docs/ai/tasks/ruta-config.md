# Tarea: Matriz de parámetros por ruta — ruta_config (HU-10)

- **Origen:** HU-10 (docs/APP_REQUIREMENTS.md:44); tabla ruta_config (PRD 4.2:229)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que un Administrador o un Socio con `configurar_ruta` consulte y configure la matriz `ruta_config` de una ruta (`GET/PUT /rutas/:id/ruta-config`), controlando lo que el cobrador puede ver/hacer en la APK. Esta HU solo almacena/consulta la matriz — el enforcement llega con la APK del cobrador y HU-13+.

## Fuera de alcance
- Enforcement de los parámetros en la app del cobrador (requiere la APK y clientes/préstamos/pagos).
- Editar la configuración core de la ruta (9a) o metadata (HU-09).

## Bloques (checklist TDD)
- [x] Bloque 1: Entidad `RutaConfig` (25 campos: 4 numéricos + 21 booleanos, FK ruta unique CASCADE) + `RutaConfigService` (`getMatriz` materializa defaults conservadores si no hay fila, `setMatriz` upsert reemplazo total con ausentes=default, 404 y ownership) + `GET/PUT /rutas/:id/ruta-config` con `@PermisoRequerido("configurar_ruta")`. Tests unitarios.
- [x] Bloque 2: e2e `test/e2e/ruta-config.e2e-spec.ts` (GET inicial defaults, PUT set, GET refleja, PUT reemplaza, 400 rangos, 404, 401, 403 ownership).

## Decisiones tomadas durante la implementación
- Endpoint `GET/PUT /rutas/:id/ruta-config` (decisión del usuario) — evita el choque con `PATCH /rutas/:id/configuracion` (9a).
- Matriz completa de 25 campos (decisión del usuario).
- Defaults conservadores lazy (decisión del usuario): sin fila = booleanos false, numéricos 0; sin backfill ni cambios en HU-08.
- Rangos numéricos (decisión del usuario): cupo_default > 0; comision_porcentaje 0–100; cuotas_minimas_prestamo >= 1; cuotas_atraso_umbral >= 1.
- PUT reemplazo total con claves ausentes = default (consistente con socio_permisos); body vacío = reset a defaults.
- Gated por `configurar_ruta` + ownership.

## Ambigüedades resueltas con el usuario
- Pregunta: ruta del endpoint → Respuesta: GET/PUT /rutas/:id/ruta-config.
- Pregunta: alcance de campos → Respuesta: matriz completa de 25.
- Pregunta: defaults → Respuesta: conservador (todo off).
- Pregunta: rangos numéricos → Respuesta: los propuestos.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+166 tests unitarios), `npm run test:e2e` (106 tests, 13 suites).
- Archivos modificados: `src/modules/rutas/ruta-config.entity.ts`, `ruta-config.service.ts` (+spec), `rutas.controller.ts` (+spec), `rutas.module.ts`, `dto/update-ruta-config-matrix.dto.ts`, `test/e2e/ruta-config.e2e-spec.ts`, `docs/ai/tasks/ruta-config.md`.
- Pendientes/seguimiento: la matriz solo se almacena/consulta; el enforcement llega con la APK del cobrador y HU-13+ (clientes/préstamos/pagos). Nota de implementación: hubo colisión de nombres de DTO con 9a (`update-ruta-config.dto.ts`) — el de 9a (interés/cuotas) se restauró y el de la matriz quedó como `update-ruta-config-matrix.dto.ts`. PUT es reemplazo total (ausentes vuelven a default).
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: defensa ante body `undefined` en `setMatriz` (`input ?? {}`), test unit de body vacío = reset, e2e de reset con `{}` y de PUT a ruta inexistente (404), ítem de backlog para el `assertOwned` duplicado en `RutaConfigService`. Nota aceptada: el 403 por falta de `configurar_ruta` está cubierto transversalmente en `editar-ruta.e2e-spec.ts` (mismo guard+permiso).
- **PR:** (a completar al abrirla)
