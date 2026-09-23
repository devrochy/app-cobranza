-- =============================================================================
-- Fix: fechas de los pagos de préstamos importados desde cartera.xlsx
--
-- Re-fecha `pagos.fecha_hora` hacia atrás desde la fecha de reporte: el pago de
-- la cuota #"CUOTAS A LA FECHA" cae un período antes de la fecha de reporte y
-- los anteriores retroceden por `DIAS ENTRE CUOTAS`.
--
-- Es idempotente: calcula el valor absoluto, se puede correr varias veces.
--
-- Uso:
--   psql "$DATABASE_URL" -v cartera_id=1787 -v fecha_reporte=2026-09-23 \
--     -f docs/ddl/fix-fechas-pagos-importacion.sql
-- =============================================================================

-- Verificación previa: pagos y la fecha que se les asignará.
SELECT pg.id AS pago_id,
       c.numero_cuota,
       :'fecha_reporte'::timestamp
         - ((COUNT(*) OVER (PARTITION BY p.id) - c.numero_cuota + 1) * p.dias_entre_cuotas
            || ' days')::interval AS fecha_nueva
FROM pagos pg
JOIN cuotas c ON c.id = pg.cuota_id
JOIN prestamos p ON p.id = c.prestamo_id
WHERE p.cartera_id = :cartera_id
ORDER BY p.id, c.numero_cuota;

BEGIN;

WITH base AS (
  SELECT pg.id AS pago_id,
         c.numero_cuota,
         p.dias_entre_cuotas,
         COUNT(*) OVER (PARTITION BY p.id) AS cA
  FROM pagos pg
  JOIN cuotas c ON c.id = pg.cuota_id
  JOIN prestamos p ON p.id = c.prestamo_id
  WHERE p.cartera_id = :cartera_id
)
UPDATE pagos pg
SET fecha_hora = :'fecha_reporte'::timestamp
                 - ((base.cA - base.numero_cuota + 1) * base.dias_entre_cuotas || ' days')::interval
FROM base
WHERE pg.id = base.pago_id;

COMMIT;
