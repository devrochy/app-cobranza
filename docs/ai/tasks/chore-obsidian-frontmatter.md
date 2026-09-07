# chore-obsidian-frontmatter

- **Rama:** `chore/obsidian-frontmatter` (desde `develop`)
- **Estado:** en progreso
- **Origen:** nota de higiene pendiente — cambios sin commitear de la sesión de setup (frontmatter Obsidian en task-docs + config opencode).

## Alcance
1. **88 archivos** `docs/ai/tasks/*.md`: agregan frontmatter YAML
   `estado: <completada|en progreso>` + `tags: [tarea]` al inicio, para que
   Obsidian pueda consultar/agrupar tareas por estado. Solo se inserta el
   frontmatter; el contenido del archivo no cambia.
2. **`opencode.json`**: cambios de la Fase 1 del setup (modelos
   `deepseek-v4-pro`/`flash`, Serena MCP, `tool_output` 500 líneas,
   `compaction` tail_turns 30).

## Definición de Terminado
- `scripts/check.sh` verde (no hay cambios de código, solo docs/config).
- Commit convencional + PR a `develop` (CI verde).

## Resultado real (llenar al completar)
- (pendiente)
