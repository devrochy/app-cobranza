# observabilidad-structured-logs

- **Rama:** `feature/observabilidad-structured-logs` (desde `develop`)
- **Estado:** en progreso
- **Alcance (TDD):** logging estructurado del interceptor HTTP para observabilidad SRE.

## Objetivo

Convertir el `RequestLoggingInterceptor` de logs de texto plano a **structured
logging** (JSON con campos parseables), incluyendo contexto de identidad
(`userId`, `role`) cuando el request está autenticado. Logs parseables =
debugging más rápido y confiable (calidad), y reduce sesiones de debugging
largas (tokens). No agrega dependencias; usa el `Logger` de NestJS con salida
JSON.

## Cambios
- `src/common/request-logging.interceptor.ts`:
  - Emitir un objeto JSON en lugar de string: `{ method, path, status, durationMs, userId?, role? }`.
  - En error: `{ method, path, status, durationMs, userId?, role?, error }`.
  - Extraer `userId`/`role` del `request.user` cuando exista (JwtAuthGuard adjunta el payload).
- Actualizar `src/common/request-logging.interceptor.spec.ts` (Red→Green).

## Definición de Terminado
- `scripts/check.sh` verde.
- Commit convencional + PR a `develop` (CI verde).

## Resultado real
- `RequestLoggingInterceptor` emite **JSON estructurado** (parseable) en vez de
  strings planos: `{ method, path, status, durationMs, userId?, role?, error? }`.
- `userId`/`role` se extraen de `req.user` (payload del JWT) cuando existe; no se
  loguean `usuario`/`jti`/password/tokens ni el body de requests.
- El campo `error` se trunca a 500 chars; se captura el mensaje de `Error` planos
  (sin `response`) — antes se perdía (JSON.stringify → `{}`).
- Spec ampliado a 5 tests (éxito, autenticado, error con response, truncado,
  error plano sin response). TDD Red→Green.
- Revisión `code-reviewer`: aprobado con observaciones atendidas (mensaje de
  Error plano).
- `scripts/check.sh` verde (880 tests).
