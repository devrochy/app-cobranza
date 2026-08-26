# CobraIA — Plataforma de Préstamos y Cobranza (Mapa de Contenido)

> Abre este repositorio como vault de Obsidian: *Open folder as vault* → `/Users/roaguilar/Projects/app-cobranza`.

## Documentación principal

- [[docs/APP_REQUIREMENTS]] — PRD funcional (fuente de verdad del negocio). **Léelo por demanda, no en cada sesión.**
- [[docs/plan-feature-roadmap]] — roadmap de ejecución (fases 0–7).
- [[AGENTS]] — reglas del sistema para agentes de IA.

## Decisiones de arquitectura (ADR)

- [[docs/ai/decisions/0001-stack-tecnico]] — Node/NestJS + TypeScript; panel en Next.js.
- [[docs/ai/decisions/0002-postgis-geografia]] — coordenadas `geography(Point)`.
- [[docs/ai/decisions/0003-metodos-pago-proveedor-global-vs-local]] — proveedor de pagos (propuesta).

## Tareas y pendientes

- [[docs/ai/tasks]] — archivos de tarea por HU (estado real persistido entre sesiones).
- [[docs/ai/tasks/backlog]] — pendientes/deuda técnica priorizada.

## Estrategia y panel

- [[docs/estrategia-metodos-pago-socios]] — estrategia de métodos de pago para socios (PRD 6.4).
- [[docs/plan-panel-admin]] — plan del panel administrativo (repo `devrochy/app-cobranza-admin`).