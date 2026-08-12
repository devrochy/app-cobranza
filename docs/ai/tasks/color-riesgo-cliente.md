# Tarea: Código de color por cliente según nivel de atraso (HU-13)

- **Origen:** HU-13 (docs/APP_REQUIREMENTS.md:47)
- **Estado:** completada
- **Fecha inicio:** 2026-08-12

## Objetivo
Capturar y fijar la regla de negocio del código de color de riesgo por cliente (azul/rojo/blanco) como función pura determinista `calcularColorRiesgo`, testeada en todos los casos. El wiring real (persistir `clientes.color_riesgo` a partir de las cuotas) se difiere a HU-14/15 (no existen clientes/préstamos/cuotas aún).

## Fuera de alcance
- Entidades clientes/préstamos/cuotas (HU-14+), persistencia de `color_riesgo`, endpoint de exposición.
- Cálculo real del atraso desde cuotas.

## Bloques (checklist TDD)
- [x] Bloque 1: `src/domain/color-riesgo.ts` con `ColorRiesgo` y `calcularColorRiesgo(atraso, umbral, esNuevoOCreditosFinalizados)` (blanco si nuevo/finalizado; rojo si atraso >= umbral; azul si no) + spec con todos los casos (nuevo, finalizado, atraso 0, < umbral, == umbral, > umbral, umbral 0).

## Decisiones tomadas durante la implementación
- Regla pura + tests ahora (decisión del usuario); wiring en HU-14/15 (limitación registrada).
- Umbral inclusivo: `atraso >= umbral` → rojo (decisión del usuario).
- Ubicación: `src/domain/` (reglas de negocio puras sin DI) — estructura nueva documentada.
- El umbral se tomará de `ruta_config.cuotas_atraso_umbral` (HU-10) en el wiring futuro.

## Ambigüedades resueltas con el usuario
- Pregunta: alcance sin clientes → Respuesta: regla pura + tests ahora.
- Pregunta: límite del umbral → Respuesta: `>=` → rojo (inclusivo).

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `scripts/check.sh` (lint+typecheck+185 tests unitarios).
- Archivos modificados: `src/domain/color-riesgo.ts`, `src/domain/color-riesgo.spec.ts`, `docs/ai/tasks/color-riesgo-cliente.md`.
- Pendientes/seguimiento (limitación registrada): el wiring (calcular `atraso` desde cuotas y persistir `clientes.color_riesgo` con el umbral de `ruta_config`) se implementa en HU-14/15. `src/domain/` es una nueva área para reglas de negocio puras sin DI.
- **Revisión independiente (code-reviewer, 2026-08-12):** APROBADO (sin bloqueantes). Correcciones aplicadas: test explícito del borde `atraso=0, umbral=0` → rojo, y JSDoc documentando el contrato de entradas no negativas.
- **PR:** (a completar al abrirla)
