---
description: Inicia el análisis de una feature nueva en Modo Planeación (solo lectura), aplicando la skill de brainstorming, sin escribir código ni archivos de tarea todavía.
agent: plan
---

Vamos a planear la siguiente feature o cambio, en modo planeación (sin editar nada todavía):

$ARGUMENTS

Aplica la skill `brainstorming`:
1. Ubica el/los requerimiento(s) relacionados en `docs/APP_REQUIREMENTS.md` (cítalos con número de HU y línea) o confirma que es una petición nueva no cubierta por el PRD.
2. Explora el código actual relevante con `Grep`/`Glob`/`Read` antes de proponer un enfoque — no asumas qué existe.
3. Entrega el resumen estructurado que pide la skill (alcance, enfoques considerados, ambigüedades bloqueantes, riesgos, fuera de alcance).
4. Si hay ambigüedades bloqueantes, pregúntame con la herramienta `question` antes de darme el resumen final.

No propongas pasar a modo ejecución todavía — al final del análisis, pregúntame explícitamente si apruebo el enfoque antes de continuar con `/start-task`.
