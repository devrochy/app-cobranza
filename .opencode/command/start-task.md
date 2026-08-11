---
description: Convierte un plan ya aprobado en un archivo de tarea formal (docs/ai/tasks/) y comienza a implementarlo siguiendo TDD estricto, bloque por bloque.
agent: build
---

El siguiente plan ya fue aprobado. Conviértelo en una tarea formal e implementa el primer bloque:

$ARGUMENTS

Pasos obligatorios:
1. Aplica la skill `task-decomposition`: crea `docs/ai/tasks/<slug>.md` con la plantilla completa, descomponiendo el plan en bloques verificables.
2. Registra los bloques también con la herramienta `todowrite` para visibilidad en esta sesión.
3. Implementa el primer bloque siguiendo estrictamente la skill `tdd-workflow` (Red → Green → Refactor).
4. Corre `scripts/check.sh` antes de marcar el bloque como completado en el archivo de tarea y en el todo list.
5. Detente después del primer bloque y muéstrame el resultado antes de continuar con el siguiente (a menos que te indique explícitamente que continúes todos los bloques sin pausas).

Si durante la descomposición encuentras una ambigüedad no resuelta en el plan original, pregúntame con `question` antes de escribir el archivo de tarea.
