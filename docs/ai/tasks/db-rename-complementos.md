---
estado: completada
tags: [tarea]
---

# Tarea: Complementos de la migración de nomenclatura en BD

- **Origen:** Petición directa del usuario (2026-09-18) al validar la migración `Ruta→Cartera / Cobrador→Gestor / Socio→Propietario` (commit `1b2d876`, PR #137) contra el esquema de base de datos.
- **Estado:** completada
- **Fecha inicio:** 2026-09-18

## Objetivo

Cerrar los huecos de la migración de nomenclatura a nivel de BD: migrar la columna de rol que faltaba, alinear los DDL de producción con las entidades nuevas y documentar el seguimiento de los payloads JSONB con claves viejas.

## Fuera de alcance

- Migrar las claves `rutaId`/`cobradorId`/`rutaNombre` dentro de columnas JSONB (decisión: solo documentar; son datos de cola/telemetría regenerables).
- Renombrar el constraint único sin nombre de `posicion_gestor` (se documenta como limitación conocida).
- Cambios en `src/` (el código ya está migrado; verificado 0 referencias a nombres viejos).
- Deploy coordinado backend/panel/APK.

## Bloques (checklist TDD)

- [x] Bloque 1: `solicitado_por_rol` migra `cobrador→gestor` / `socio→propietario` en el SQL de rename.
  - Archivo: `docs/ddl/rename-cartera-gestor-propietario.sql` (sección 4).
  - Verificación: el `VALUES` incluye `('cambios_cliente_pendientes','solicitado_por_rol')`.
- [x] Bloque 2: DDL de producción del snapshot usa los nombres nuevos.
  - Archivo: `docs/ddl/ruta_estadisticas_snapshot.sql` → `docs/ddl/cartera_estadisticas_snapshot.sql` (git mv).
  - Verificación: tabla/columna/FK/constraint coinciden con `cartera-estadisticas-snapshot.entity.ts:18-19`.
- [x] Bloque 3: DDL de limpieza de color de riesgo usa los nombres nuevos.
  - Archivo: `docs/ddl/fix-color-riesgo.sql`.
  - Verificación: `cartera_config` / `cartera_id` (0 referencias a `ruta_config`/`ruta_id`).
- [x] Bloque 4: seguimiento documentado de payloads JSONB y del constraint de `posicion_gestor`.
  - Archivo: `docs/ai/tasks/backlog.md`.

## Decisiones tomadas durante la implementación

- Estas son modificaciones de DDL/documentación sin comportamiento de runtime; no aplica un test unitario Red→Green. La validación es de esquema (aplicar los SQL contra un Postgres y comparar `information_schema` contra las entidades) + `scripts/check.sh` para descartar regresiones. Se declara como limitación conocida (ver `AGENTS.md` §6).
- No se migran las claves dentro de los JSONB.

## Ambigüedades resueltas con el usuario

- Payloads JSONB con claves viejas → **Solo documentar en backlog** (no migrar datos).
- Constraint de `posicion_gestor` → **Documentar y dejar** (sin cambio de código).
- Archivo DDL del snapshot → **Renombrar con git mv**.

## Resultado final (llenar al completar)

- Comandos ejecutados para verificar:
  - `bash scripts/check.sh` → lint + typecheck + **119 suites / 1018 tests** en verde.
  - Postgres 16/PostGIS local (`docker compose up -d postgres`):
    - `rename-cartera-gestor-propietario.sql` ejecutado dos veces → idempotente (`DO`/`UPDATE 0`), sin errores.
    - Conversión de roles en `cambios_cliente_pendientes.solicitado_por_rol` verificada en transacción (rollback): `cobrador→gestor`, `socio→propietario`, `admin` sin cambio.
    - `cartera_estadisticas_snapshot.sql` aplicado en schema scratch: crea la tabla con columnas nuevas, PK, `uq_cartera_estadisticas_snapshot_cartera_fecha` y FK a `carteras(id)`.
    - `fix-color-riesgo.sql` ejecutado en transacción (rollback) contra el esquema renombrado → `UPDATE 0`, sin errores.
- Archivos modificados:
  - `docs/ddl/rename-cartera-gestor-propietario.sql` — sección 4 incluye `solicitado_por_rol`.
  - `docs/ddl/ruta_estadisticas_snapshot.sql` → `docs/ddl/cartera_estadisticas_snapshot.sql` (git mv + nombres nuevos).
  - `docs/ddl/fix-color-riesgo.sql` — `ruta_config`→`cartera_config`, `ruta_id`→`cartera_id`.
  - `docs/ai/tasks/backlog.md` — 2 ítems de seguimiento (JSONB con claves viejas; constraint de `posicion_gestor`).
  - `docs/ai/tasks/db-rename-complementos.md` — esta tarea.
- Pendientes/seguimiento:
  - Claves JSONB (`rutaId`/`cobradorId`/`rutaNombre`) en históricos → decisión: no migrar (backlog).
  - Constraint único sin nombre en `posicion_gestor` → documentado (backlog).
- Limitación conocida: la validación fue de esquema (aplicar los SQL contra Postgres), no un test unitario Red→Green, por tratarse de DDL/documentación sin runtime (ver `AGENTS.md` §6).
