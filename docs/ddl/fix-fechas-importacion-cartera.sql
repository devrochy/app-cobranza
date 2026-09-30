-- =============================================================================
-- Fix: fechas de cuotas de préstamos importados desde cartera.xlsx
--
-- Contexto: la importación generaba las cuotas hacia adelante desde la FECHA
-- reportada, dejando las cuotas YA PAGADAS con vencimientos posteriores a esa
-- fecha. El criterio correcto es que la cuota #"CUOTAS A LA FECHA" caiga en la
-- FECHA reportada (pagadas hacia atrás, pendientes hacia adelante).
--
-- Este script desplaza `cA * dias_entre_cuotas` días hacia atrás:
--   - prestamos.fecha_otorgado
--   - todas las cuotas del préstamo (fecha_vencimiento)
-- donde `cA` = nº de cuotas con estatus 'pagada' (lo importado como
-- "CUOTAS A LA FECHA").
--
-- ⚠️ NO es idempotente: la BD no guarda la FECHA reportada por separado, así que
-- el estado ya corregido es indistinguible del original. Correr UNA sola vez por
-- entorno (usar la cartera que se importó).
--
-- Uso:
--   psql "$DATABASE_URL" -v cartera_id=1787 \
--     -f docs/ddl/fix-fechas-importacion-cartera.sql
-- =============================================================================

-- Verificación previa: imprime el desplazamiento que se aplicará.
SELECT p.id AS prestamo_id,
       p.fecha_otorgado AS fecha_otorgado_actual,
       (p.dias_entre_cuotas * COUNT(c.id) FILTER (WHERE c.estatus = 'pagada'))::int
         AS dias_a_retroceder
FROM prestamos p
JOIN cuotas c ON c.prestamo_id = p.id
WHERE p.cartera_id = :cartera_id
GROUP BY p.id, p.fecha_otorgado, p.dias_entre_cuotas
ORDER BY p.id;

BEGIN;

CREATE TEMP TABLE _desplazamiento_import ON COMMIT DROP AS
SELECT p.id AS prestamo_id,
       (p.dias_entre_cuotas * COUNT(c.id) FILTER (WHERE c.estatus = 'pagada'))::int AS dias
FROM prestamos p
JOIN cuotas c ON c.prestamo_id = p.id
WHERE p.cartera_id = :cartera_id
GROUP BY p.id, p.dias_entre_cuotas
HAVING COUNT(c.id) FILTER (WHERE c.estatus = 'pagada') > 0;

UPDATE cuotas c
SET fecha_vencimiento = c.fecha_vencimiento - d.dias
FROM _desplazamiento_import d
WHERE c.prestamo_id = d.prestamo_id;

UPDATE prestamos p
SET fecha_otorgado = p.fecha_otorgado - (d.dias || ' days')::interval
FROM _desplazamiento_import d
WHERE p.id = d.prestamo_id;

COMMIT;
