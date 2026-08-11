# AGENTS.md — Reglas del sistema para agentes de IA en este repositorio

Este archivo se carga automáticamente en cada sesión de OpenCode (ver `instructions` en `opencode.json`). Es la fuente de verdad sobre **cómo debe comportarse el agente** en este proyecto. Ningún subagente, skill o comando puede contradecir estas reglas.

## 0. Contexto del proyecto

- Producto: plataforma de préstamos y cobranza con asistente de IA por WhatsApp, optimización de rutas y seguridad por dispositivo (ver `docs/APP_REQUIREMENTS.md` — es la fuente de verdad funcional, no la reinterpretes ni la resumas de memoria, léela).
- Stack: Node.js + TypeScript + NestJS (backend/API), Jest (tests), PostgreSQL + PostGIS, panel admin en Next.js/React (repositorio separado o `apps/admin` cuando se decida — no asumas su existencia hasta que se cree explícitamente).
- Fase actual: **MVP local** (ver sección 6 de `docs/APP_REQUIREMENTS.md`). No se debe integrar WhatsApp Business API, LLM en producción, ni tracking GPS en vivo hasta que el documento de requerimientos lo autorice explícitamente para esa fase.

## 1. Modo de Planeación vs. Modo de Ejecución

Este proyecto usa los dos modos nativos de OpenCode. **No se salta de uno a otro sin una entrega concreta.**

### Modo Planeación (`plan` — agente `plan`, sin permiso de edición)

Úsalo para: leer requerimientos, investigar el código existente, diseñar un enfoque, identificar ambigüedades, estimar alcance.

Salida obligatoria del modo planeación antes de pasar a ejecución:
1. Un resumen del alcance en texto (qué se va a construir y qué NO se va a construir en esta iteración).
2. La lista de preguntas/ambigüedades sin resolver (ver sección 3). Si hay alguna, **no se avanza a ejecución** hasta resolverla con el usuario.
3. La descomposición en tareas cortas (ver skill `task-decomposition`).

### Modo Ejecución (`build` — agente `build`, con permiso de edición)

Úsalo solo después de que el plan fue aprobado explícitamente por el usuario (o por ti mismo si el alcance es trivial y de una sola tarea, como un typo o un ajuste de config).

Primer paso obligatorio al entrar en modo ejecución para cualquier tarea no trivial:
1. Escribir el archivo de tarea en `docs/ai/tasks/<slug>.md` usando la plantilla de la skill `task-decomposition`.
2. Seguir el ciclo TDD descrito en la skill `tdd-workflow` para cada bloque de la tarea.
3. Actualizar el archivo de tarea con el resultado real (no dejarlo como intención, sino como registro de lo que efectivamente se hizo).

**Nunca** escribas código de producción directamente en modo ejecución sin haber pasado por el modo planeación para features nuevas (CRUD de una entidad, integración externa, cambio de esquema de base de datos, lógica de negocio nueva). Excepciones permitidas sin plan formal: fixes de una línea, ajustes de lint/formato, actualizar documentación.

## 2. Jerarquía de fuentes de verdad

Cuando haya conflicto, este es el orden de autoridad (de mayor a menor):
1. Instrucción explícita del usuario en la conversación actual.
2. `docs/APP_REQUIREMENTS.md` (PRD funcional).
3. Este archivo (`AGENTS.md`).
4. Archivos de tarea existentes en `docs/ai/tasks/`.
5. Convenciones ya presentes en el código (si el código y el PRD contradicen, señala la contradicción, no la resuelvas en silencio).

## 3. No asumas contextos ambiguos — protocolo obligatorio

Si te falta información para tomar una decisión de negocio, seguridad o de esquema de datos, **detente y pregunta** usando la herramienta `question`. No es aceptable "elegir lo más razonable" cuando la decisión es de negocio (ej. reglas de mora, límites financieros de la IA, formato de moneda) o de seguridad (ej. qué pasa si el IMEI no coincide).

Ejemplos de lo que SÍ requiere preguntar (lista no exhaustiva):
- Reglas de negociación financiera de la IA (montos, plazos, umbrales) no definidas explícitamente en el PRD o en la tarea.
- Cualquier decisión que afecte datos personales/financieros de clientes y no esté ya resuelta en el PRD.
- Nombres de variables de entorno para secretos que no existan aún en `.env.example`.
- Elegir entre dos librerías/enfoques técnicos con implicaciones de costo o licencia distintas.

Ejemplos de lo que NO requiere preguntar (puedes decidir y documentar la decisión en el archivo de tarea):
- Nombre de una función interna, estructura de carpetas dentro de un módulo ya aprobado.
- Redacción exacta de un mensaje de log.
- Orden de los parámetros de una función privada.

## 4. Anti-alucinación

- Antes de referenciar una función, clase, endpoint, variable de entorno o archivo, **verifícalo** con `Read`/`Grep`/`Glob`. No asumas que existe porque "normalmente existe en NestJS".
- Antes de usar una API externa (WhatsApp Cloud API, Google Maps Platform, Anthropic/OpenCode Zen, proveedor de mapas), **consulta la documentación oficial** con `webfetch` si no la tienes ya confirmada en la sesión, y cita la URL consultada en el archivo de tarea o en el comentario de código relevante.
- Si no puedes verificar algo (por ejemplo, un límite de rate-limit de una API de terceros) dilo explícitamente como suposición pendiente de validar, no lo presentes como un hecho confirmado.
- Nunca inventes datos de negocio (tasas de interés, montos, nombres de clientes reales) — usa siempre datos de prueba claramente marcados como ficticios (`test-`, `fixture-`, etc.).

## 5. Anti-redundancia

- Antes de crear una función, módulo, DTO o componente, busca con `Grep`/`Glob` si ya existe algo equivalente. Reutiliza antes de duplicar.
- Si detectas lógica duplicada mientras trabajas en algo distinto, no la arregles en el mismo cambio (evita mezclar refactors con features); regístralo como una entrada nueva en `docs/ai/tasks/backlog.md` para tratarla aparte.
- No relees archivos que ya están completos en el contexto de la sesión actual salvo que hayan podido cambiar (por ejemplo, después de una edición de otro proceso).

## 6. Definición de "Terminado" (Definition of Done)

Una tarea NO se marca como completada (`todowrite` status `completed`) hasta que:
1. `scripts/check.sh` pasa completo (lint + typecheck + tests unitarios) — ver skill `tdd-workflow`.
2. Se agregaron pruebas nuevas que cubren el comportamiento agregado/cambiado, y existían **antes** del código de producción (Red → Green → Refactor).
3. El archivo de tarea en `docs/ai/tasks/<slug>.md` está actualizado con el resultado real.
4. No quedan `TODO`/`FIXME` sin registrar como ítem de seguimiento explícito.
5. Si el cambio toca git (commit/PR), se siguió la skill `github-gitflow-cicd` (branch correcto, commit convencional, PR con descripción y referencia a la tarea).

Si algo de esto no se puede cumplir (ej. no hay forma de probar unitariamente una integración externa todavía), decláralo explícitamente en el archivo de tarea como limitación conocida — no lo omitas en silencio.

## 7. Economía de tokens y sesiones largas

- Prefiere `Grep`/`Glob` sobre leer archivos completos cuando solo necesitas ubicar algo.
- Usa el subagente `explore` (vía `Task`) para investigación amplia del código en vez de leer múltiples archivos grandes tú mismo en el hilo principal.
- No repitas en tus respuestas contenido que ya está en el archivo de tarea; referencia el archivo (`docs/ai/tasks/<slug>.md:linea`) en vez de copiarlo.
- La compactación automática de contexto está habilitada (ver `opencode.json`). Si notas que la sesión lleva muchas horas/turnos y el rendimiento decae, sugiere al usuario iniciar una sesión nueva referenciando el archivo de tarea (que ya persiste el estado real, no depende de la memoria de la conversación).
- Antes de invocar al subagente `code-reviewer` o `git-release-manager`, asegúrate de que la tarea esté realmente lista — no lo invoques como "borrador para pensar en voz alta"; son subagentes de verificación, no de brainstorming.

## 8. Seguridad y secretos

- Nunca hardcodees credenciales, tokens o números de WhatsApp/teléfono reales. Usa siempre `process.env.*` y documenta la variable en `.env.example` (sin valor real).
- Nunca ejecutes `cat`, `echo` o cualquier comando que imprima el contenido de `.env*` — está bloqueado por configuración de permisos, pero tampoco lo intentes.
- Cualquier dato de cliente/cartera en ejemplos, tests o seeds debe ser sintético.
- Antes de ejecutar un comando destructivo (`rm`, `git push --force`, migraciones contra una base de datos que no sea local) espera confirmación explícita — la configuración de permisos ya lo exige, pero además debes explicar por qué es necesario antes de pedir la confirmación.

## 9. Evitar bucles improductivos ("doom loops")

Si llevas 3 intentos fallidos consecutivos resolviendo el mismo error (mismo test rojo, mismo error de compilación), **detente** y:
1. Resume qué intentaste y por qué falló cada intento.
2. Aplica la skill `systematic-debugging` para diagnosticar causa raíz en vez de seguir probando cambios al azar.
3. Si aun así no hay progreso, pregunta al usuario en vez de seguir intentando silenciosamente.

## 10. Subagentes disponibles en este proyecto

- `code-reviewer`: revisión de código de solo lectura contra el checklist de calidad. Invócalo antes de dar por terminada cualquier tarea no trivial.
- `git-release-manager`: ejecuta operaciones de git/GitHub siguiendo GitFlow (branches, commits convencionales, PRs, tags de release). Es el único agente que debería ejecutar `git push`, `gh pr create` o `git tag`.
- `explore` (built-in): investigación de código/documentación de solo lectura, modelo económico —úsalo para exploración amplia.

No dupliques manualmente lo que un subagente ya hace mejor (ej. no escribas tú el mensaje de commit si vas a invocar a `git-release-manager`).
