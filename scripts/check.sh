#!/usr/bin/env bash
# Verificación completa antes de marcar cualquier tarea como completada.
# Ver AGENTS.md sección 6 (Definición de "Terminado").
set -euo pipefail

echo "==> Lint"
npm run lint --silent

echo "==> Typecheck"
npm run typecheck --silent

echo "==> Tests unitarios"
npm run test --silent

echo "==> OK: lint + typecheck + tests pasaron correctamente."
