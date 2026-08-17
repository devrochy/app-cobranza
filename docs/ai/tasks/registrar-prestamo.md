# Tarea: Registrar préstamo a cliente respetando el cupo (HU-14)

- **Origen:** HU-14 (docs/APP_REQUIREMENTS.md:53)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Que se pueda registrar un préstamo a un cliente de una ruta (`POST /rutas/:rutaId/prestamos`) con valor, cuotas, ubicación, interés cerrado y periodo por días, respetando el cupo de la ruta (`ruta_config`), generando las cuotas y actualizando el color de riesgo. Incluye el registro del cliente (`POST /rutas/:rutaId/clientes`) porque no hay HU de cliente previa.

## Fuera de alcance
- Pagos/abonos (HU-15), motivos de no pago (HU-16), gastos (HU-17).
- Enforcement APK/cobrador y permiso del socio (diferidos; admin-only en el MVP).
- Unicidad de cliente (teléfono) — se decide/documenta.

## Bloques (checklist TDD)
- [x] Bloque 1: Entidades `Cliente`, `Prestamo` (con desviaciones `tipo_interes`, `dias_entre_cuotas`) y `Cuota` + módulo `cartera` registrado en AppModule. Ajuste del default `cuotas_atraso_umbral` de `ruta_config` a 1. Verificación: tablas creadas.
- [x] Bloque 2: `ClienteService.crear(rutaId, dto, requester)` (404 ruta, ownership, color blanco) + `POST /rutas/:rutaId/clientes`. Tests unitarios.
- [x] Bloque 3: `PrestamoService` — validaciones (valor>0, numCuotas >= cuotas_minimas, tipoInteres default/override, diasEntreCuotas>0), 404 ruta/cliente, **cupo** (si manejo_cupo_activo: saldoVigente + valor <= cupo_default → 409). Tests unitarios.
- [x] Bloque 4: Generación de cuotas + persistencia transaccional. Tests unitarios.
- [x] Bloque 5: Wiring del color de riesgo (recalcular `clientes.colorRiesgo` con `calcularColorRiesgo` + umbral de ruta_config). Tests unitarios.
- [x] Bloque 6: e2e `test/e2e/prestamos.e2e-spec.ts` (201 con cuotas generadas, cupo 409, 404 ruta/cliente, 400 validaciones, 401, color del cliente).

## Decisiones tomadas durante la implementación
- HU-14 cubre cliente + préstamo + cuotas (decisión del usuario).
- Cupo = valor + saldo vigente (cuotas pendientes/atrasadas de préstamos vigentes) <= cupo_default (decisión del usuario).
- Interés: default de la ruta + override opcional; se persiste `prestamos.tipo_interes` (desviación del PRD 4.2, backlog).
- Periodo por días definido en el préstamo (`dias_entre_cuotas`, desviación del PRD 4.2) (decisión del usuario).
- Actor admin-only en el MVP (cobrador vía APK y socio diferidos) (interpretación del usuario).
- Redondeo de cuota: la última absorbe el remanente.
- Transacción para préstamo + cuotas.
- Default `cuotas_atraso_umbral` de ruta_config a 1 (evita el caso degenerado "atraso 0 → rojo" con umbral 0).

## Ambigüedades resueltas con el usuario
- Pregunta: alcance → Cliente + préstamo + cuotas.
- Pregunta: cupo → valor + saldo vigente <= cupo_default.
- Pregunta: interés → default de la ruta + override opcional.
- Pregunta: periodicidad → por días, definida al generar el préstamo.
- Pregunta: actor → APK y panel según permisos; MVP admin-only.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+203 tests unitarios), `npm run test:e2e` (135 tests, 16 suites).
- Archivos modificados: `src/modules/cartera/*` (cliente/prestamo/cuota entities, services, controller, module, dtos), `src/modules/rutas/ruta-config.service.ts` (default umbral a 1), `src/app.module.ts`, `test/e2e/prestamos.e2e-spec.ts`, `docs/ai/tasks/registrar-prestamo.md`.
- Pendientes/seguimiento: se implementó el wiring de HU-13 (color) y la desviación `prestamos.tipo_interes` + `prestamos.dias_entre_cuotas`; actor admin-only MVP (cobrador/socio diferidos). Nota: `delete` de TypeORM con criterio anidado de relación falla en `Prestamo` (dos relaciones) — la limpieza e2e usa query builder con columnas directas.
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO CON OBSERVACIONES (sin bloqueantes). Correcciones aplicadas: update del color no-fatal (try/catch + warn), test de rollback, test de redondeo de la última cuota (100/7), rangos de lat/lng en el DTO, e2e de 403 socio sin permiso y de forbidNonWhitelisted, backlog actualizado (assertOwned 6 usos, numericTransformer 5 entidades, delete anidado de TypeORM en Prestamo, unicidad del teléfono decidida como NO única en MVP). Nota: el umbral `cuotas_atraso_umbral` ya está protegido por `@Min(1)` en el DTO de ruta_config y su default ahora es 1.
- **PR:** https://github.com/devrochy/app-cobranza/pull/17 (feature/registrar-prestamo → develop), CI en verde (build-and-test + e2e).
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Se incorporó el commit `ac3f1dd` (amplía `RequesterContext`/`Requester*Context` a `RolUsuario` + mock de `DataSource` en specs de cartera, preparación para el rol cobrador). Observaciones no bloqueantes registradas en backlog: mock de DataSource innecesario en `cartera.controller.spec`, `assertOwned` del cobrador por `ruta.cobradorId` (futuro), y precisar que el commit no habilita aún el rol cobrador (RolUsuario sigue siendo "admin" | "socio").
