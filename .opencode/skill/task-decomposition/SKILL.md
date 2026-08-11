---
name: task-decomposition
description: Usar al pasar de Modo Planeación a Modo Ejecución, para dividir un plan aprobado en bloques cortos, verificables e independientes, y registrarlos como archivo de tarea en docs/ai/tasks/. Usar también cuando una tarea existente resulta ser más grande de lo esperado y necesita partirse.
---

# Descomposición de tareas en bloques cortos

Objetivo: que cada unidad de trabajo sea pequeña, verificable por sí misma, y quede documentada — nunca "una sesión larga sin checkpoints".

## Reglas de tamaño de bloque

Un bloque de tarea debe poder:
- Completarse siguiendo un ciclo TDD completo (Red → Green → Refactor) en una sola pasada razonable.
- Verificarse de forma automática (`scripts/check.sh` en verde) sin depender de que otro bloque futuro exista.
- Describirse en una frase tipo Historia de Usuario o Criterio de Aceptación, no como "trabajar en el módulo de rutas" (demasiado amplio).

Si un bloque no cumple esto, divídelo más. Regla práctica: si no puedes escribir el primer test en menos de 5 minutos de haber leído el bloque, es demasiado grande o está mal definido.

## Plantilla del archivo de tarea

Crea el archivo en `docs/ai/tasks/<slug-corto>.md` (ejemplo: `docs/ai/tasks/registrar-ruta.md`) con esta estructura exacta:

```markdown
# Tarea: <nombre corto>

- **Origen:** HU-XX (docs/APP_REQUIREMENTS.md:línea) | Petición directa del usuario
- **Estado:** pendiente | en progreso | completada | bloqueada
- **Fecha inicio:** YYYY-MM-DD

## Objetivo
(una frase: qué comportamiento observable debe existir al terminar)

## Fuera de alcance
- ...

## Bloques (checklist TDD)
- [ ] Bloque 1: <criterio de aceptación en una frase>
  - Test(s) que lo prueban: `ruta/al/archivo.spec.ts`
- [ ] Bloque 2: ...

## Decisiones tomadas durante la implementación
- ...

## Ambigüedades resueltas con el usuario
- Pregunta: ... → Respuesta: ...

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: ...
- Archivos modificados: ...
- Pendientes/seguimiento (si algún punto quedó fuera): ...
```

## Reglas de disciplina

1. **No se empieza un bloque nuevo si el anterior no pasó `scripts/check.sh`.** No acumules bloques "a medio hacer" en paralelo.
2. Actualiza el checkbox del bloque (`- [x]`) inmediatamente al completarlo, no al final de toda la tarea.
3. Si durante la ejecución descubres que falta información de negocio, no la inventes: regístrala en "Ambigüedades resueltas con el usuario" después de preguntar con la herramienta `question`.
4. Si una tarea termina bloqueada (no se puede seguir sin algo externo, ej. credenciales de WhatsApp), márcala como `bloqueada` con la razón exacta — no la dejes en `en progreso` indefinidamente.
5. Usa `todowrite` en paralelo a este archivo para que el usuario vea el progreso en vivo dentro de la sesión, pero el archivo en `docs/ai/tasks/` es la fuente persistente entre sesiones (el todo list de la sesión se pierde; el archivo no).
