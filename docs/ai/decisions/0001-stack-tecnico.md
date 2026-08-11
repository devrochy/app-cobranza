# ADR-0001: Stack técnico base (Node.js + NestJS + TypeScript)

- **Estado:** aceptada
- **Fecha:** 2026-08-11

## Contexto

`docs/APP_REQUIREMENTS.md` sugiere dos alternativas de stack para el backend: Node.js/NestJS o Python/FastAPI, sin decidir una. Era necesario fijar una sola opción antes de generar la estructura base del repositorio y las skills de TDD/CI-CD (que dependen del lenguaje elegido).

## Decisión

Se elige **Node.js + TypeScript + NestJS** para el backend, y se mantiene TypeScript también para el panel administrativo (React/Next.js), buscando un stack end-to-end en un solo lenguaje.

## Justificación

1. **Consistencia de lenguaje end-to-end**: backend (NestJS) y panel admin (Next.js/React) comparten TypeScript, lo que reduce el "cambio de contexto" del agente de IA entre sesiones y reduce el riesgo de alucinación por mezclar convenciones de dos ecosistemas distintos.
2. **Ecosistema de integración**: las integraciones externas del PRD (WhatsApp Cloud API, Google Maps Platform, colas de mensajería) tienen SDKs/clientes HTTP maduros en Node.js.
3. **TDD nativo y bien soportado**: NestJS incluye su propio módulo de testing sobre Jest, con inyección de dependencias que facilita mockear servicios externos (WhatsApp, LLM, Maps) sin tocar infraestructura real — clave para la estrategia de MVP local (sección 6 del PRD).
4. **Tipado fuerte**: reduce errores de forma de datos entre capas (DTOs de NestJS + tipos compartidos), lo cual es relevante dado el volumen de entidades del dominio (socios, cobradores, rutas, clientes, préstamos, cuotas, pagos, abonos, gastos, inyecciones, liquidaciones).

## Alternativas consideradas

- **Python + FastAPI**: viable y también sugerida en el PRD; se descarta por ahora para evitar dos lenguajes distintos entre backend y panel admin. Si en el futuro se necesita Python específicamente para tareas de datos/ML (ej. modelos de score de riesgo de mora), puede introducirse como un servicio separado sin reescribir el core.

## Consecuencias

- Las skills `tdd-workflow` y `github-gitflow-cicd`, y el pipeline de CI, asumen Jest + npm/TypeScript.
- Si esta decisión cambia, hay que actualizar: `scripts/check.sh`, `.github/workflows/ci.yml`, `package.json`, y las referencias a Jest en las skills.
