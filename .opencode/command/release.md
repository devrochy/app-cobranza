---
description: Orquesta un release siguiendo GitFlow (branch de release, changelog, PR a main, tag) a través del subagente git-release-manager. No usar para trabajo de features en curso.
agent: git-release-manager
---

Prepara un release de tipo: $ARGUMENTS (ej. "patch", "minor", "major")

Sigue la skill `github-gitflow-cicd` sección "Releases" al pie de la letra:
1. Confirma que `develop` está limpio y con CI en verde antes de continuar.
2. Corta la rama `release/<version>` correspondiente.
3. Actualiza `CHANGELOG.md` agrupando los commits desde el último tag por tipo (feat/fix/etc.).
4. Abre el PR `release/<version>` → `main` con la descripción estándar.
5. Detente ahí y pídeme confirmación explícita antes de mergear o taguear — no lo hagas de forma autónoma.
