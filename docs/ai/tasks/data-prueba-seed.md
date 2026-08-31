# Tarea: data-prueba-seed (migración de datos de prueba)

- **Origen:** Plan aprobado por el usuario (cargar migración de data de prueba para pruebas visuales e identificar mejoras).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-30

## Objetivo
Poblar la BD local del backend con datos sintéticos (`test-`/`fixture-`) e idempotentes para que el panel admin tenga contenido visual en todas las pantallas: socios, cobradores, rutas (detalle + gastos/inyecciones), cartera, reportes y dashboard con gráficos.

## Fuera de alcance
- Producción: el seed se gatea por `SEED_TEST_DATA=true` (nunca corre en producción).
- Datos reales de negocio (AGENTS.md §4: sintéticos con prefijos test/fixture).

## Bloques (checklist TDD)

- [x] Bloque 1: módulo `test-data` + gate por env + idempotencia (marker socio `test-socio-1`).
  - Test(s): `test-data.seed.service.spec.ts` (gating, sin admin, idempotencia).
  - **Hecho (2026-08-31):** `TestDataModule` + `TestDataSeedService` (OnApplicationBootstrap con `setTimeout` para correr tras el admin seed). Se ampliaron exports de `RutasModule`/`CarteraModule`. Guard adicional: no corre si `NODE_ENV=production`.
- [x] Bloque 2: orquestación del seed.
  - Test(s): `test-data.seed.service.spec.ts` (happy path: llama a servicios con contexto admin, aprobar gasto, liquidación, reporte diario).
  - **Hecho (2026-08-31):** socio+permisos, 2 cobradores, 2 rutas (ruta A con fotos requeridas + fechas editables), 16 clientes (8 con fotos), 14 préstamos (6 atrasados → mora), pagos de cuotas, gastos (1 con evidencia, 1 aprobado), inyecciones, notas, 1 liquidación, reporte diario.
- [x] Bloque 3: ejecución contra el backend local.
  - **Hecho (2026-08-31):** `SEED_TEST_DATA=true` en `.env` local (gitignored) + `.env.example` documentado. Se levantó colima + Postgres y el backend; el seed cargó y se verificó en BD: 1 socio, 2 cobradores, 2 rutas, 16 clientes, 14 préstamos, 96 cuotas (15 atrasadas, 6 pagadas), 6 pagos, 2 gastos, 2 inyecciones, 1 nota, 1 liquidación, reporte diario con trayectorias.

## Decisiones tomadas durante la implementación
- Seed vía **servicios reales del dominio** (no repos directos) para ejercitar wiring real: generación de cuotas, caja, geography, hash de password.
- Requester admin: `{ rol: "admin", sub: <adminId> }` (se toma el admin activo; si no hay, se salta — el admin seed lo crea).
- Ruta A con `reconocimientoFacialActivo`/`registroDocumentoCliente` (fotos requeridas en el panel) y `permitirCambioFechaPrestamo` (préstamos atrasados → mora).
- Pagos de cuotas "hoy" para que el dashboard muestre cobradoDia/Semana > 0.
- Evidencias de gasto/fotos: metadatos placeholder (sin archivo real; no hay endpoint de descarga).

## Ambigüedades resueltas con el usuario
- (ninguna abierta)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (740 tests, 86 suites); seed ejecutado contra BD local y verificado con `psql` (conteos por entidad).
- Archivos modificados:
  - `src/modules/test-data/test-data.module.ts`, `src/modules/test-data/test-data.seed.service.ts` (+ spec).
  - `src/modules/rutas/rutas.module.ts`, `src/modules/cartera/cartera.module.ts` — exports ampliados.
  - `src/app.module.ts` — registra `TestDataModule`.
  - `.env.example` — documenta `SEED_TEST_DATA`.
  - `docs/ai/tasks/data-prueba-seed.md`.
- `SEED_TEST_DATA=true` quedó en `.env` local (gitignored) para que el backend cargue la data en dev; es idempotente.
- Pendientes/seguimiento:
  - Pruebas visuales del panel por el usuario (login admin) para identificar mejoras.
  - Evidencias de gasto/foto son metadatos placeholder (sin archivo real; no hay endpoint de descarga).