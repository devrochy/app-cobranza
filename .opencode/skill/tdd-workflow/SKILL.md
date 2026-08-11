---
name: tdd-workflow
description: Usar para CUALQUIER cambio de código de producción en este repositorio (nueva funcionalidad, fix de bug, refactor). Aplica el ciclo estricto Red-Green-Refactor. Usar también cuando el usuario pida "implementa X", "agrega Y", "corrige Z" en modo build.
---

# Flujo TDD obligatorio (Red → Green → Refactor)

En este proyecto **no se escribe código de producción sin una prueba que falle primero.** Esta regla no es negociable salvo para: configuración pura, tipos/interfaces sin lógica, y documentación.

## Ciclo por cada bloque de la tarea (ver skill `task-decomposition`)

### 1. RED — escribe la prueba que falla
- Escribe el test que describe el comportamiento esperado del bloque, usando el framework del proyecto (Jest para NestJS).
- Ejecuta el test y **confirma que falla por la razón correcta** (no por un typo o un import roto). Si falla por una razón distinta a "la funcionalidad no existe todavía", corrige el test antes de continuar.
- No escribas todavía el código de producción.

### 2. GREEN — el mínimo código para pasar
- Escribe la implementación más simple posible que haga pasar el test. No optimices ni generalices todavía.
- Ejecuta la prueba y confirma que pasa. Ejecuta también el resto de la suite para confirmar que no rompiste nada existente.

### 3. REFACTOR — limpia con la red de seguridad puesta
- Con los tests en verde, mejora nombres, elimina duplicación, ajusta estructura.
- Vuelve a correr toda la suite después de cada cambio de refactor, no solo al final.

Repite el ciclo para el siguiente bloque. No avances al siguiente bloque de la tarea si el actual no está en verde.

## Qué probar primero (orden de prioridad)

1. Reglas de negocio explícitas del PRD (ej. "un cobrador siempre pertenece a un socio", "bloquear un cobrador bloquea en cascada sus rutas").
2. Casos borde: entrada vacía/nula, límites (cupo máximo, umbral de atraso), permisos denegados.
3. Camino feliz (happy path) — sorprendentemente va de último, porque si los casos 1 y 2 pasan, el happy path casi siempre ya está cubierto.

## Comando de verificación

Después de cada bloque, corre:

```bash
scripts/check.sh
```

Este script ejecuta lint + typecheck + tests unitarios. Una tarea no puede marcarse como completada (ver `AGENTS.md` sección 6) si este script falla.

## Qué hacer si un test queda rojo y no sabes por qué

No sigas cambiando código al azar. Cambia a la skill `systematic-debugging` — está diseñada exactamente para este momento.

## Cobertura mínima esperada

- Todo módulo de dominio (rutas, cobradores, socios, préstamos, pagos, gastos, liquidaciones, reglas de negociación de la IA) requiere tests unitarios de sus reglas de negocio antes de considerarse hecho.
- Los endpoints HTTP requieren al menos un test de integración/e2e por caso de uso principal (happy path + un caso de error de autorización).
- No se requiere (por ahora, fase MVP local) cobertura e2e de integraciones externas reales (WhatsApp, Maps, LLM) — esas se prueban con dobles/mocks hasta que el PRD autorice la fase de piloto controlado.
