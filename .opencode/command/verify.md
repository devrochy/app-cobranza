---
description: Corre la verificación completa de una tarea (lint+typecheck+tests), delega la revisión al subagente code-reviewer y, si aprueba, hace el commit + PR de la HU completada vía git-release-manager.
agent: build
---

Verifica el estado actual de la tarea: $ARGUMENTS

Pasos:
1. Ejecuta `scripts/check.sh` y muéstrame el resultado real (no resumas si falla, pega el error).
2. Si pasa, invoca al subagente `code-reviewer` (vía `Task`) pasándole la ruta del archivo de tarea y los archivos modificados (usa `git diff` para identificarlos).
3. Muéstrame el veredicto del `code-reviewer` sin editarlo ni suavizarlo.
4. Solo si el veredicto es "APROBADO" (o "APROBADO CON OBSERVACIONES" y confirmas conmigo que las observaciones no son bloqueantes), actualiza el archivo de tarea con el resultado final y marca los todos correspondientes como completados.
5. Si el veredicto es "RECHAZADO", NO marques nada como completado — vuelve a modo ejecución sobre los hallazgos bloqueantes.
6. **Commit + PR obligatorio por HU completada** (AGENTS.md sección 6, punto 5): delega en el subagente `git-release-manager` la creación de la rama `feature/<slug>` desde `develop`, los commits Conventional Commits y la PR a `develop` con la descripción obligatoria de la skill `github-gitflow-cicd`. La HU no se considera terminada sin la PR abierta y el pipeline de CI en verde.
