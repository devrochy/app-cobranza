---
name: github-gitflow-cicd
description: Usar para cualquier operación de git/GitHub (crear branch, commit, PR, merge, release, tag) y para modificar o interpretar los workflows de CI/CD en .github/workflows/. Aplica la estrategia GitFlow del proyecto. Normalmente se ejecuta a través del subagente git-release-manager, no directamente por el agente de build.
---

# GitFlow + CI/CD de este repositorio

## Ramas

- `main`: solo código en producción. Nunca se le hace push directo.
- `develop`: rama de integración. Todo feature termina aquí antes de un release.
- `feature/<slug>`: una feature o tarea de `docs/ai/tasks/`. Sale de `develop`, vuelve a `develop` vía PR.
- `release/<version>`: se corta desde `develop` cuando se prepara una versión. Solo fixes menores aquí. Al cerrar, se mergea a `main` Y a `develop`, y se tagea.
- `hotfix/<slug>`: sale de `main` para un fix urgente en producción. Se mergea a `main` Y a `develop`, y se tagea.

Nomenclatura de slug: kebab-case, referencia al archivo de tarea cuando exista (ej. `feature/registrar-ruta`, coincidiendo con `docs/ai/tasks/registrar-ruta.md`).

## Commits (Conventional Commits)

Formato: `<tipo>(<alcance opcional>): <descripción corta en imperativo>`

Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `build`.

Ejemplos:
- `feat(rutas): agregar validación de cupo máximo al registrar préstamo`
- `fix(cobradores): bloquear en cascada las rutas al desactivar un cobrador`
- `test(liquidaciones): cubrir cálculo de comisión con porcentaje configurable`

No mezclar tipos distintos en un solo commit (si hiciste un fix y agregaste tests, son dos commits: `test(...)` primero como RED, luego `fix(...)` como GREEN, honrando el ciclo TDD en el propio historial de git).

## Pull Requests

- Título: igual convención que el commit principal del PR.
- Descripción obligatoria:
  ```markdown
  ## Tarea
  Referencia: docs/ai/tasks/<slug>.md

  ## Cambios
  - ...

  ## Cómo se probó
  - `scripts/check.sh` → verde
  - Revisión de `code-reviewer`: APROBADO / APROBADO CON OBSERVACIONES (adjuntar resumen)

  ## Fuera de alcance / seguimiento
  - ...
  ```
- Todo PR hacia `develop` o `main` requiere que `scripts/check.sh` haya pasado localmente Y que el pipeline de CI (`.github/workflows/ci.yml`) esté en verde antes de mergear.
- El merge a `main` o la creación de un tag de versión la ejecuta únicamente el subagente `git-release-manager`, nunca el agente de `build` directamente (ver `AGENTS.md` sección 10).

## CI/CD (`.github/workflows/ci.yml`)

El pipeline en este repo corre en cada push/PR y hace, en este orden:
1. Instalar dependencias (con cache).
2. Lint.
3. Typecheck.
4. Tests unitarios con cobertura.
5. (Cuando exista `docker-compose.yml` de servicios, ej. Postgres para tests de integración) levantar servicios y correr tests e2e.
6. Escaneo de secretos (gitleaks) — bloqueante si encuentra un secreto expuesto.

No modifiques este pipeline para "saltarte" un paso que esté fallando (ej. comentar el paso de tests) — si un paso falla legítimamente, la tarea no está terminada; corrígela con `systematic-debugging`, no ocultes el fallo.

## Releases

1. Confirmar que `develop` está verde en CI.
2. Cortar `release/<version>` desde `develop`.
3. Actualizar `CHANGELOG.md` (agrupado por tipo de commit desde el último tag).
4. Abrir PR de `release/<version>` → `main`.
5. Al aprobar y mergear: taguear `v<version>` sobre `main`, y mergear `main` de vuelta a `develop` para mantenerlas sincronizadas.

Sigue semver: `MAJOR.MINOR.PATCH`. Cambios de reglas de negocio de cobranza/negociación de la IA que alteren comportamiento observable para el usuario final ameritan al menos un `MINOR`.
