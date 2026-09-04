# backend-liquidacion-cobrador

- **Rama:** `feature/backend-liquidacion-cobrador` (desde `develop`)
- **Estado:** en progreso
- **Dependencias:** `backend-pago-liquidado`
- **Alcance (TDD):** exponer la liquidación del día a la APK (cobrador),
  exportar el resumen en PDF y exponer `visitaRegistrada` en la lista del día.

## Objetivo

La pestaña "Día" de la APK necesita: (1) saber si todos los clientes del día
ya tienen visita (para habilitar la liquidación), (2) generar/consultar la
liquidación del día y (3) descargar el resumen en PDF.

## Cambios

- `src/modules/rutas/liquidaciones.service.ts`:
  - `exportarPdf(rutaId, liquidacionId, requester)`: PDF (pdfkit, A4) con el
    resumen de la liquidación y el detalle de pagos/abonos del día
    (`obtenerDetalle` por la fecha de la liquidación).
  - Helper `obtenerDetalle` (usa `dataSource.getRepository(Pago/Abono)`) y
    `itemDetalle` compartido con `marcarLiquidados`.
- `src/modules/cobrador/cobrador.service.ts`: inyecta `LiquidacionesService`;
  delega `generarLiquidacion`, `listarLiquidaciones`, `exportarLiquidacionPdf`.
- `src/modules/cobrador/cobrador.controller.ts` (permiso `generar_reporte`):
  - `POST rutas/:rutaId/liquidaciones` (GenerarLiquidacionDto)
  - `GET rutas/:rutaId/liquidaciones`
  - `GET rutas/:rutaId/liquidaciones/:liquidacionId/export-pdf` (Content-Type application/pdf)
- `src/modules/rutas/lista-clientes-dia.service.ts`: `ClienteDiaPublic.visitaRegistrada`
  (hoy tiene visita pago/abono o no pago).

## Definición de Terminado
- `scripts/check.sh` backend verde.
- Specs: `liquidaciones.service.spec.ts` (exportarPdf), `cobrador.service.spec.ts`
  (delegaciones), `lista-clientes-dia.service.spec.ts` (visitaRegistrada).
- Commit convencional + PR a `develop` (CI verde).

## Resultado real (llenar al completar)
- (pendiente)