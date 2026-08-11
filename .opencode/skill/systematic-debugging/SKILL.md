---
name: systematic-debugging
description: Usar cuando un test falla de forma inesperada, hay un bug reportado, o después de 2-3 intentos fallidos de arreglar algo cambiando código al azar. Fuerza un diagnóstico de causa raíz antes de aplicar una corrección. Usar también ante errores intermitentes/flaky.
---

# Depuración sistemática (evitar "parchar a ciegas")

Señal de que necesitas esta skill: llevas más de un intento cambiando código sin haber confirmado primero *por qué* falla. Si ya llevas 3 intentos fallidos, esto es obligatorio (ver `AGENTS.md` sección 9, regla anti-doom-loop).

## Protocolo de 5 pasos

### 1. Reproduce de forma aislada
- Ejecuta únicamente el test/caso que falla (no toda la suite) para tener el ciclo de feedback más corto posible.
- Confirma que el fallo es determinista. Si es intermitente, anótalo — es información relevante (posible condición de carrera, dependencia de orden de tests, uso de `Date.now()`/aleatoriedad sin mockear).

### 2. Lee el error completo, no lo asumas
- Lee el mensaje de error y el stack trace línea por línea antes de teorizar. Usa `Grep` para ubicar exactamente la línea señalada.
- Si el error viene de una librería externa, verifica la versión instalada (`package.json` / lockfile) antes de asumir el comportamiento documentado en internet.

### 3. Formula una hipótesis única y verificable
- Escribe explícitamente: "Creo que falla porque ___". Debe ser una afirmación que puedas confirmar o refutar con una prueba puntual (un `console.log`, un test más pequeño, una aserción intermedia) — no una lista de 5 posibles causas a la vez.

### 4. Verifica la hipótesis con el mínimo cambio posible
- Agrega solo lo necesario para confirmar o refutar la hipótesis (un log, un test unitario más pequeño que aísle la pieza sospechosa).
- Si la hipótesis se refuta, vuelve al paso 3 con una nueva hipótesis informada por lo que acabas de descartar — no repitas hipótesis ya refutadas.

### 5. Corrige la causa raíz, no el síntoma
- La corrección debe explicar por qué el bug ocurría, no solo hacer que el test específico pase (ej. no agregues un `if` que solo cubre el caso del test si el problema real es una validación faltante más general).
- Después de corregir, **agrega o ajusta un test que hubiera atrapado este bug antes** de que llegara a producción, aunque el bloque de la tarea original no lo pidiera explícitamente.

## Cuándo detenerte y preguntar al usuario

- Si after completar el paso 4 dos veces (dos hipótesis distintas refutadas) sigues sin causa raíz clara.
- Si la causa raíz parece estar fuera del código del proyecto (bug de una librería externa, comportamiento no documentado de una API de terceros) — confírmalo con `webfetch` a la documentación oficial antes de concluir esto.
- Si arreglar la causa raíz implica un cambio de alcance mayor al de la tarea actual (ej. "hay que rediseñar el módulo completo") — eso vuelve a Modo Planeación, no se decide sobre la marcha.

## Registro

Documenta brevemente en el archivo de tarea (`docs/ai/tasks/<slug>.md`, sección "Decisiones tomadas durante la implementación") cuál fue la causa raíz encontrada — sirve como memoria para no repetir el mismo error en otro módulo.
