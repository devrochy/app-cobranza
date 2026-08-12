# Backlog de seguimiento

Ítems detectados durante el trabajo en una tarea que **no** se resuelven en esa misma tarea (para no mezclar refactors/deuda técnica con features), según la regla de anti-redundancia de `AGENTS.md` sección 5.

Formato de cada entrada:

```markdown
## <título corto>
- Detectado en: docs/ai/tasks/<slug-origen>.md
- Fecha: YYYY-MM-DD
- Descripción: ...
- Prioridad sugerida: alta | media | baja
```

---

## `prestamos.tipo_interes` — desviación del PRD 4.2 para HU-14
- Detectado en: docs/ai/tasks/editar-nombre-ruta.md
- Fecha: 2026-08-12
- Descripción: el PRD 4.2 define `prestamos` sin `tipo_interes`, pero el modelo de dominio acordado es "la ruta solo tiene defaults y el préstamo cierra su propia tasa". Para validar/recalcular cuotas por préstamo y mantener reportes correctos, `prestamos` debe agregar `tipo_interes` al registrarlo (HU-14). Las cuotas se generan con la tasa del préstamo, no la de la ruta.
- Prioridad sugerida: alta (necesario antes de HU-14)

## Moneda de ruta no editable (decisión de producto)
- Detectado en: docs/ai/tasks/editar-nombre-ruta.md
- Fecha: 2026-08-12
- Descripción: la `moneda` de una ruta NO es editable tras el registro (decisión del usuario) para evitar mezclar monedas en estadísticas/liquidaciones. La edición de configuración de ruta cubre solo tipoInteres y numCuotas (nueva HU 9a en el roadmap).
- Prioridad sugerida: media

## Cascada de bloqueo de rutas sin transacción
- Detectado en: docs/ai/tasks/registrar-ruta.md (revisión code-reviewer)
- Fecha: 2026-08-12
- Descripción: en `CobradoresService.setEstatus`, el `save` del cobrador y el `update` de rutas (`aplicarCascada`) no comparten transacción; si la cascada falla, el cobrador queda bloqueado con rutas activas sin rollback. Evaluar envolver ambos en una transacción (o al menos loguear el fallo de cascada para reconciliación).
- Prioridad sugerida: media

## JwtAuthGuard no revalida el estado del admin por request
- Detectado en: docs/ai/tasks/matriz-permisos-socio.md (revisión code-reviewer)
- Fecha: 2026-08-11
- Descripción: `JwtAuthGuard` valida el token (tipo access) pero no consulta si el admin sigue activo por request: un admin bloqueado con access token vigente (15m) puede operar. Es un patrón pre-existente en todo el módulo. Evaluar revalidar `estado` del admin en el guard (o al menos al entrar en HU-07 cuando existan roles).
- Prioridad sugerida: media

## Unicidad de correo case-insensitive
- Detectado en: docs/ai/tasks/editar-socio-cobrador.md (revisión code-reviewer)
- Fecha: 2026-08-11
- Descripción: la unicidad de `correo` (socios/cobradores) es case-sensitive por default en Postgres: `Correo@x.com` y `correo@x.com` pueden coexistir. Considerar normalizar a minúsculas al crear/editar (afecta create y update de ambos módulos).
- Prioridad sugerida: media

## Extraer helper compartido de unicidad/conflicto (23505) tras el 3er uso
- Detectado en: docs/ai/tasks/registrar-cobrador.md
- Fecha: 2026-08-11
- Descripción: `isUniqueViolation` + `assertNoConflicts` + `toPublic` (y ahora `setEstatus`) están duplicados entre `socios.service.ts` y `cobradores.service.ts`. Si HU-08 (rutas) u otra HU vuelve a necesitar la misma validación/operación, extraer un servicio/helper común; si no, revisar este ítem cuando se toque socios/cobradores. También se podría mover `UpdateEstatusDto` a una ubicación común (`src/common/`) al hacerlo.
- Prioridad sugerida: media

## Blacklist/revocación de refresh tokens
- Detectado en: docs/ai/tasks/login-administrador.md
- Fecha: 2026-08-11
- Descripción: el refresh token es stateless (sin tabla de blacklist). Para logout y rotación segura con revocación real hará falta una tabla de tokens emitidos/revocados o lista negra.
- Prioridad sugerida: media

## Rate limiting del endpoint /auth/login
- Detectado en: docs/ai/tasks/login-administrador.md
- Fecha: 2026-08-11
- Descripción: el login no tiene límite de intentos por IP/usuario; riesgo de fuerza bruta. Agregar throttling (ej. @nestjs/throttler) cuando se exponga fuera de local.
- Prioridad sugerida: alta
