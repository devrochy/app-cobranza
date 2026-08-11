---
name: brainstorming
description: Usar al inicio de cualquier feature nueva, cambio de alcance, o cuando el usuario pide "cómo deberíamos resolver X" antes de escribir código. Genera opciones de diseño, identifica ambigüedades y riesgos antes de decidir un enfoque. NO usar para bugs pequeños o tareas ya completamente especificadas.
---

# Brainstorming previo al diseño

Objetivo: evitar que el agente empiece a codificar con una interpretación equivocada del problema. Esta skill se usa en **Modo Planeación** (agente `plan`), antes de cualquier archivo de tarea.

## Pasos obligatorios

1. **Relee la fuente del requerimiento.** Si viene de `docs/APP_REQUIREMENTS.md`, cita la(s) historia(s) de usuario exacta(s) (ej. "HU-14, HU-15") y el número de línea. Si viene solo de la conversación, resume la petición en una frase antes de continuar.

2. **Lista al menos 2 enfoques de diseño viables** cuando exista más de una forma razonable de resolverlo (ej. "validar el cupo en el DTO vs. en un guard de NestJS vs. en el servicio de dominio"). Para cada uno anota: ventaja, desventaja, y si tiene implicación de costo/licencia (ej. una librería de pago).

3. **Identifica ambigüedades** usando el protocolo de la sección 3 de `AGENTS.md`. Sepáralas en:
   - Bloqueantes (no se puede avanzar sin resolverlas) → deben resolverse con la herramienta `question` antes de seguir.
   - No bloqueantes (se puede decidir razonablemente y documentar la decisión).

4. **Identifica riesgos técnicos** conocidos de antemano: dependencias externas no confirmadas (WhatsApp Cloud API, Google Maps), datos sensibles involucrados, posible impacto en otros módulos ya existentes (usa `Grep`/`Glob` para confirmar qué toca realmente, no asumas).

5. **Propone el enfoque recomendado** con una justificación de una a tres líneas, dejando explícito qué NO se va a hacer en esta iteración (alcance negativo).

## Salida esperada de esta skill

Un resumen en el chat (no un archivo todavía) con esta estructura:

```
## Alcance propuesto
...

## Enfoques considerados
1. ... (recomendado)
2. ...

## Ambigüedades bloqueantes
- ...  (si hay alguna, pregunta con `question` ANTES de continuar)

## Riesgos conocidos
- ...

## Fuera de alcance en esta iteración
- ...
```

Este resumen es el insumo directo para la skill `task-decomposition`, que lo convierte en el archivo de tarea formal una vez aprobado.
