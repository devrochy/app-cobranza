# Tarea: Regla de días de cobro (ajuste por día no laborable + mora)

- **Origen:** Roadmap Fase 1 ítem 5 (docs/plan-feature-roadmap.md:23) — HU-13/HU-15/HU-16 (docs/APP_REQUIREMENTS.md:47,50,58,59)
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-17

## Objetivo
Aplicar la regla de días de cobro: al generar cuotas se ajusta el vencimiento al siguiente día hábil si cae en día no laborable (solo domingos en MVP), y un job diario marca como `atrasada` las cuotas desde el día siguiente a su vencimiento ajustado, alimentando el color de riesgo de HU-13.

## Fuera de alcance
- HU-15 (pagos de cuota/abono) y HU-16 (motivos de no pago) — ítems 7 y 8 de Fase 1.
- Fuente de feriados por país (`domingos_y_feriados` queda configurable pero sin comportamiento distinto en MVP).
- Días de mora para reportes/listas del día (Fase 2/3).

## Decisiones tomadas durante la implementación
- Ajuste de vencimiento: **atrasar al siguiente día hábil** (domingo → lunes) — decisión del usuario.
- Feriados: **solo domingos** en MVP; `domingos_y_feriados` se configura pero se comporta igual que `solo_domingos`.
- Mora: **persistida por job** con `@nestjs/schedule` (nueva dependencia autorizada).
- "Cobro efectivo" = día de vencimiento ajustado; la mora comienza el día siguiente.
- Zona horaria del job: se documenta y se decide en implementación (usar zona del operador, no UTC).

## Bloques (checklist TDD)
- [x] Bloque 1: Agregar `diasNoLaborables` (enum `solo_domingos`/`domingos_y_feriados`, default `solo_domingos`) a `ruta-config.entity.ts`, `RutaConfigDefaults`, `RutaConfigPublic` y DTO `update-ruta-config-matrix.dto.ts`.
  - Test(s): `src/modules/rutas/ruta-config.service.spec.ts`, e2e `ruta-config`
- [x] Bloque 2: Helper de dominio `src/domain/dias-no-laborables.ts` (`ajustarDiaHabil`) + integrar en `generarCuotas` leyendo `ruta_config` en `crear`.
  - Test(s): `src/domain/dias-no-laborables.spec.ts`, `src/modules/cartera/prestamo.service.spec.ts`, e2e `prestamos`
- [x] Bloque 3: Job de mora con `@nestjs/schedule` que marque `atrasada` cuotas `pendiente` con `fecha_vencimiento < hoy`.
  - Test(s): `src/modules/cartera/mora-job.service.spec.ts`, e2e `mora-job`
- Verificación: `scripts/check.sh` + `npm run test:e2e`.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿adelantar o atrasar si vence en día no laborable? → **Atrasar al siguiente día hábil**.
- Pregunta: ¿cómo manejar feriados? → **Solo domingos en MVP**.
- Pregunta: ¿cómo determinar la mora? → **Persistida por job**.
- Pregunta: ¿qué infraestructura para el job? → **Agregar `@nestjs/schedule`**.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint + typecheck + 231 tests) y `npm run test:e2e` (17 suites, 138 tests) en verde.
- Archivos modificados: `src/modules/rutas/ruta-config.entity.ts` (+`DIAS_NO_LABORABLES`), `ruta-config.service.ts`, `dto/update-ruta-config-matrix.dto.ts`, `src/domain/dias-no-laborables.ts` (+spec), `src/modules/cartera/prestamo.service.ts` (+spec), `src/modules/cartera/mora-job.service.ts` (+spec), `cartera.module.ts`, `src/app.module.ts` (ScheduleModule), `src/common/date.ts` (+spec), `test/e2e/ruta-config.e2e-spec.ts`, `test/e2e/mora-job.e2e-spec.ts`, `package.json` (+`@nestjs/schedule`), `docs/ai/tasks/regla-dias-cobro.md`.
- **Revisión final (code-reviewer, 2026-08-17):** APROBADO CON OBSERVACIONES (sin bloqueantes). Se atendieron: duplicación de `formatDate` → extraído a `src/common/date.ts` (anti-redundancia §5); se agregó test del caso borde "cuota que vence hoy" (no se marca atrasada) y se renombró el test débil del job. Observaciones restantes (limitaciones documentadas, no bloqueantes): zona horaria del cron vs comparación UTC (depende de la zona del operador, decisión de negocio pendiente); cobertura e2e del ajuste domingo→lunes solo a nivel unitario; `domingos_y_feriados` se comporta igual que `solo_domingos` hasta tener fuente de feriados (queda en seguimiento).
- Pendientes/seguimiento: HU-15 (pagos) y HU-16 (motivos) son los ítems 7 y 8 de Fase 1 y consumirán el estatus `atrasada` del job; fuente de feriados por país; decidir la zona horaria del job de mora según operación. **Pendiente commit + PR.**
