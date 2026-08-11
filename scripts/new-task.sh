#!/usr/bin/env bash
# Crea un archivo de tarea nuevo desde la plantilla (ver skill task-decomposition).
# Uso: scripts/new-task.sh nombre-corto-de-la-tarea
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <slug-de-la-tarea>"
  exit 1
fi

SLUG="$1"
FILE="docs/ai/tasks/${SLUG}.md"

if [ -f "$FILE" ]; then
  echo "Ya existe: $FILE"
  exit 1
fi

cat > "$FILE" <<EOF
# Tarea: ${SLUG}

- **Origen:** (HU-XX en docs/APP_REQUIREMENTS.md:línea | Petición directa del usuario)
- **Estado:** pendiente
- **Fecha inicio:** $(date +%Y-%m-%d)

## Objetivo
(una frase: qué comportamiento observable debe existir al terminar)

## Fuera de alcance
- ...

## Bloques (checklist TDD)
- [ ] Bloque 1: <criterio de aceptación en una frase>
  - Test(s) que lo prueban: \`ruta/al/archivo.spec.ts\`

## Decisiones tomadas durante la implementación
- ...

## Ambigüedades resueltas con el usuario
- ...

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: ...
- Archivos modificados: ...
- Pendientes/seguimiento: ...
EOF

echo "Creado: $FILE"
