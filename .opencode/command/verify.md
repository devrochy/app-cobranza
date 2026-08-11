---
description: Corre la verificación completa de una tarea (lint+typecheck+tests) y delega una revisión independiente al subagente code-reviewer antes de marcarla como completada.
agent: build
---

Verifica el estado actual de la tarea: $ARGUMENTS

Pasos:
1. Ejecuta `scripts/check.sh` y muéstrame el resultado real (no resumas si falla, pega el error).
2. Si pasa, invoca al subagente `code-reviewer` (vía `Task`) pasándole la ruta del archivo de tarea y los archivos modificados (usa `git diff` para identificarlos).
3. Muéstrame el veredicto del `code-reviewer` sin editarlo ni suavizarlo.
4. Solo si el veredicto es "APROBADO" (o "APROBADO CON OBSERVACIONES" y confirmas conmigo que las observaciones no son bloqueantes), actualiza el archivo de tarea con el resultado final y marca los todos correspondientes como completados.
5. Si el veredicto es "RECHAZADO", NO marques nada como completado — vuelve a modo ejecución sobre los hallazgos bloqueantes.
