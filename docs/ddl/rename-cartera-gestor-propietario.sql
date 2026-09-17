-- =============================================================================
-- Rename de nomenclatura: Ruta→Cartera, Cobrador→Gestor, Socio→Propietario
-- Ver docs/glosario.md (app-cobranza-admin) — constitución de la migración.
--
-- Contexto: el backend usa TypeORM con `synchronize: true` en entornos no-prod.
-- `synchronize` CREA tablas nuevas y AGREGA columnas, pero NO renombra tablas ni
-- columnas. Por eso, para preservar los datos de una BD existente hay que
-- renombrar explícitamente antes de desplegar las entidades nuevas.
--
-- Este script es idempotente: se puede correr varias veces. Solo renombra si el
-- objeto con nombre viejo existe y el nuevo no. Ejecutar con:
--   psql "$DATABASE_URL" -f docs/ddl/rename-cartera-gestor-propietario.sql
--
-- IMPORTANTE (datos en JSONB): los payloads de `sincronizacion_offline`,
-- `reportes_diarios.*_json` y `cartera_optimizada_log.orden_clientes_json`
-- pueden contener claves `rutaId`/`cobradorId`/`rutaNombre`. NO se migran aquí
-- (son datos de cola/telemetría); ver seguimiento en la tarea de migración.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Rename de tablas (usadas también por las FK entrantes, que Postgres actualiza)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('rutas',                     'carteras'),
      ('ruta_config',               'cartera_config'),
      ('ruta_notas',                'cartera_notas'),
      ('rutas_aperturas',           'carteras_aperturas'),
      ('ruta_estadisticas_snapshot','cartera_estadisticas_snapshot'),
      ('ruta_optimizada_log',       'cartera_optimizada_log'),
      ('posicion_cobrador',         'posicion_gestor'),
      ('cobradores',                'gestores'),
      ('cobrador_permisos',         'gestor_permisos'),
      ('socios',                    'propietarios'),
      ('socio_permisos',            'propietario_permisos'),
      ('cobros_socio',              'cobros_propietario'),
      ('mensajes_socio',            'mensajes_propietario'),
      ('conversaciones_socio',      'conversaciones_propietario')
    ) AS t(old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_name = r.old_name)
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = current_schema() AND table_name = r.new_name)
    THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', r.old_name, r.new_name);
      RAISE NOTICE 'tabla renombrada: % -> %', r.old_name, r.new_name;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Rename de columnas FK (nombres de tabla NUEVOS)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- FKs hacia cartera (antes ruta)
      ('carteras',                       'socio_id',       'propietario_id'),
      ('carteras',                       'cobrador_id',    'gestor_id'),
      ('cartera_config',                 'ruta_id',        'cartera_id'),
      ('cartera_notas',                  'ruta_id',        'cartera_id'),
      ('carteras_aperturas',             'ruta_id',        'cartera_id'),
      ('cartera_estadisticas_snapshot',  'ruta_id',        'cartera_id'),
      ('cartera_optimizada_log',         'ruta_id',        'cartera_id'),
      ('caja',                           'ruta_id',        'cartera_id'),
      ('gastos',                         'ruta_id',        'cartera_id'),
      ('inyecciones',                    'ruta_id',        'cartera_id'),
      ('liquidaciones',                  'ruta_id',        'cartera_id'),
      ('reportes_diarios',               'ruta_id',        'cartera_id'),
      ('clientes',                       'ruta_id',        'cartera_id'),
      ('prestamos',                      'ruta_id',        'cartera_id'),
      ('visitas',                        'ruta_id',        'cartera_id'),
      ('devices',                        'ruta_id',        'cartera_id'),
      -- FK hacia gestor (antes cobrador)
      ('posicion_gestor',                'cobrador_id',    'gestor_id'),
      ('posicion_gestor',                'ruta_id',        'cartera_id'),
      ('gestores',                       'socio_id',       'propietario_id'),
      ('gestor_permisos',                'cobrador_id',    'gestor_id'),
      ('devices',                        'cobrador_id',    'gestor_id'),
      ('intentos_acceso',                'cobrador_id',    'gestor_id'),
      -- FK hacia propietario (antes socio)
      ('propietario_permisos',           'socio_id',       'propietario_id'),
      ('cobros_propietario',             'socio_id',       'propietario_id'),
      ('conversaciones_propietario',     'socio_id',       'propietario_id'),
      ('links_pago',                     'cobro_socio_id', 'cobro_propietario_id')
    ) AS t(tbl, old_col, new_col)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = r.tbl
                  AND column_name = r.old_col)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = r.tbl
                          AND column_name = r.new_col)
    THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', r.tbl, r.old_col, r.new_col);
      RAISE NOTICE 'columna renombrada: %.% -> %', r.tbl, r.old_col, r.new_col;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Rename de constraints UNIQUE (deben coincidir con los @Unique de las entidades)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('gestor_permisos',               'UQ_cobrador_permiso',                        'UQ_gestor_permiso'),
      ('propietario_permisos',          'UQ_socio_permiso',                           'UQ_propietario_permiso'),
      ('cobros_propietario',            'UQ_cobro_socio_periodo',                     'UQ_cobro_propietario_periodo'),
      ('liquidaciones',                 'UQ_liquidacion_ruta_periodo_fecha',          'UQ_liquidacion_cartera_periodo_fecha'),
      ('cartera_estadisticas_snapshot', 'uq_ruta_estadisticas_snapshot_ruta_fecha',   'uq_cartera_estadisticas_snapshot_cartera_fecha')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.old_name)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.new_name)
    THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', r.tbl, r.old_name, r.new_name);
      RAISE NOTICE 'constraint renombrado: % -> %', r.old_name, r.new_name;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Migración de datos: roles almacenados como texto
--    (columnas *_rol guardan 'admin' | 'socio' | 'cobrador')
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('cartera_notas',      'creado_por_rol'),
      ('gasto_evidencias',   'creado_por_rol'),
      ('cliente_evidencias', 'creado_por_rol'),
      ('visitas',            'creado_por_rol'),
      ('auditoria_cartera',  'actor_rol'),
      ('caja_ajustes_log',   'actor_rol')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = r.tbl
                  AND column_name = r.col)
    THEN
      EXECUTE format(
        'UPDATE %I SET %I = CASE %I WHEN ''cobrador'' THEN ''gestor'' WHEN ''socio'' THEN ''propietario'' ELSE %I END
         WHERE %I IN (''cobrador'',''socio'')',
        r.tbl, r.col, r.col, r.col, r.col
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Migración de datos: nombres de permisos
-- -----------------------------------------------------------------------------
-- Catálogo del gestor (antes cobrador)
UPDATE gestor_permisos
   SET permiso = CASE permiso
     WHEN 'anotar_notas_ruta' THEN 'anotar_notas_cartera'
     WHEN 'actualizar_ruta'   THEN 'actualizar_cartera'
     ELSE permiso
   END
 WHERE permiso IN ('anotar_notas_ruta', 'actualizar_ruta');

-- Catálogo del propietario (antes socio)
UPDATE propietario_permisos
   SET permiso = CASE permiso
     WHEN 'anotar_notas_ruta'            THEN 'anotar_notas_cartera'
     WHEN 'eliminar_rutas'               THEN 'eliminar_carteras'
     WHEN 'configurar_ruta'              THEN 'configurar_cartera'
     WHEN 'registrar_ruta'               THEN 'registrar_cartera'
     WHEN 'bloquear_cobradores'          THEN 'bloquear_gestores'
     WHEN 'registrar_cobrador'           THEN 'registrar_gestor'
     WHEN 'registrar_socio'              THEN 'registrar_propietario'
     WHEN 'bloquear_socio'               THEN 'bloquear_propietario'
     WHEN 'eliminar_socio'               THEN 'eliminar_propietario'
     WHEN 'editar_configuracion_socio'   THEN 'editar_configuracion_propietario'
     ELSE permiso
   END
 WHERE permiso IN (
   'anotar_notas_ruta', 'eliminar_rutas', 'configurar_ruta', 'registrar_ruta',
   'bloquear_cobradores', 'registrar_cobrador', 'registrar_socio',
   'bloquear_socio', 'eliminar_socio', 'editar_configuracion_socio'
 );

-- -----------------------------------------------------------------------------
-- 6. Feature "ruta habilitada" en la cartera (nueva columna de configuración)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = current_schema()
                    AND table_name = 'cartera_config'
                    AND column_name = 'ruta_habilitada')
  THEN
    ALTER TABLE cartera_config
      ADD COLUMN ruta_habilitada boolean NOT NULL DEFAULT false;
    RAISE NOTICE 'columna agregada: cartera_config.ruta_habilitada';
  END IF;
END $$;

COMMIT;
