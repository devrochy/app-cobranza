# app-cobranza

Plataforma de préstamos y cobranza con asistente de IA (WhatsApp), optimización de rutas y seguridad por dispositivo. Ver especificación funcional completa en [`docs/APP_REQUIREMENTS.md`](docs/APP_REQUIREMENTS.md).

Este repositorio está configurado para trabajarse con **OpenCode** siguiendo una disciplina estricta de TDD, descomposición de tareas y GitFlow. Las reglas del agente están en [`AGENTS.md`](AGENTS.md).

## Stack

Node.js + TypeScript + NestJS (backend) · Jest (tests) · PostgreSQL/PostGIS (planeado) · GitFlow + GitHub Actions (CI/CD).

Ver la justificación de esta decisión en [`docs/ai/decisions/0001-stack-tecnico.md`](docs/ai/decisions/0001-stack-tecnico.md).

## Fase actual: MVP local

No hay integraciones de producción activas todavía (WhatsApp, LLM, tracking en tiempo real). Ver sección 6 de `docs/APP_REQUIREMENTS.md` para el plan de fases.

## Requisitos

- Node.js 20+
- npm 10+
- (Fase 2 en adelante) PostgreSQL 16+ con extensión PostGIS

## Setup rápido

```bash
./scripts/setup.sh
npm test
```

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Levanta el backend en modo watch |
| `npm run lint` | ESLint sobre `src/` y `test/` |
| `npm run typecheck` | Verifica tipos sin emitir |
| `npm test` | Tests unitarios (Jest) |
| `npm run test:cov` | Tests unitarios con reporte de cobertura |
| `npm run test:e2e` | Tests end-to-end |
| `scripts/check.sh` | lint + typecheck + tests — el mismo gate que exige `AGENTS.md` antes de dar por terminada una tarea |
| `scripts/new-task.sh <slug>` | Crea un archivo de tarea nuevo en `docs/ai/tasks/` desde la plantilla |

## Estructura del repositorio

```
app-cobranza/
├── AGENTS.md                 # Reglas del agente de IA (leer primero)
├── opencode.json             # Config de OpenCode: modelos, permisos, MCP, skills
├── .env.example
├── .opencode/
│   ├── agent/                # Subagentes: code-reviewer, git-release-manager
│   ├── command/               # /plan-feature, /start-task, /verify, /release
│   ├── skill/                  # brainstorming, task-decomposition, tdd-workflow,
│   │                          # systematic-debugging, github-gitflow-cicd
│   └── plugin/                # env-guard.ts (protección adicional de secretos)
├── docs/
│   ├── APP_REQUIREMENTS.md    # PRD funcional (fuente de verdad de negocio)
│   └── ai/
│       ├── decisions/         # ADRs (decisiones de arquitectura)
│       ├── tasks/             # Un archivo por tarea (histórico persistente)
│       └── memory/            # Memoria persistente del MCP "memory" (no se commitea)
├── scripts/                  # setup.sh, check.sh, new-task.sh
├── src/                      # Código de la app (NestJS)
├── test/e2e/                 # Tests end-to-end
└── .github/workflows/ci.yml  # Pipeline de CI
```

## Flujo de trabajo con OpenCode

Ver instrucciones completas de inicialización en la respuesta que generó este repositorio, o resumidas aquí:

1. `/plan-feature <descripción>` — analiza el requerimiento en modo planeación (solo lectura), sin escribir código.
2. Revisa y aprueba el plan.
3. `/start-task <plan aprobado>` — crea el archivo de tarea y empieza a implementar con TDD, bloque por bloque.
4. `/verify <tarea>` — corre `scripts/check.sh` y delega una revisión independiente al subagente `code-reviewer`.
5. `/release <patch|minor|major>` — solo cuando haya algo listo para publicar; lo ejecuta el subagente `git-release-manager` siguiendo GitFlow.
