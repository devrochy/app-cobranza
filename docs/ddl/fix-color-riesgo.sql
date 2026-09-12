-- Cleanup: recalcula `clientes."colorRiesgo"` según el atraso vs el umbral de la ruta.
-- Motivo: el color solo se calculaba al crear un préstamo (hasta el fix de recálculo
-- en pagos/eliminaciones/mora). Aplicar una vez por entorno con datos históricos.
-- Idempotente: solo actualiza las filas que difieren.
WITH calc AS (
  SELECT p.cliente_id,
         COUNT(*) FILTER (WHERE c.estatus = 'atrasada') AS atrasadas,
         COUNT(*) FILTER (WHERE c.estatus IN ('pendiente', 'atrasada')) AS no_pagadas,
         MIN(COALESCE(rc."cuotasAtrasoUmbral", 1)) AS umbral
  FROM prestamos p
  JOIN cuotas c ON c.prestamo_id = p.id
  LEFT JOIN ruta_config rc ON rc.ruta_id = p.ruta_id
  GROUP BY p.cliente_id
),
target AS (
  SELECT cliente_id,
         CASE
           WHEN no_pagadas = 0 THEN 'blanco'
           WHEN atrasadas >= umbral THEN 'rojo'
           ELSE 'azul'
         END AS esperado
  FROM calc
)
UPDATE clientes cl
SET "colorRiesgo" = t.esperado
FROM target t
WHERE cl.id = t.cliente_id
  AND cl."colorRiesgo" IS DISTINCT FROM t.esperado;
