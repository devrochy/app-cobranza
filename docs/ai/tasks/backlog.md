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

## `assertOwned` duplicado en RutaConfigService (3er uso)
- Detectado en: docs/ai/tasks/ruta-config.md (revisión code-reviewer)
- Fecha: 2026-08-12
- Descripción: `ruta-config.service.ts` replica el `assertOwned` de `rutas.service.ts` (misma lógica socio-sobre-sus-rutas). Con `inyecciones.service.ts`, `cliente.service.ts` y `prestamo.service.ts` ya son 6 usos (rutas, ruta-config, inyecciones, cliente, prestamo). Conviene extraer un helper compartido. También se duplica el `numericTransformer` en 5 entidades (ruta, ruta-config, inyeccion, prestamo, cuota).
- Prioridad sugerida: media
- Estado: **programada como Fase 0 del roadmap** (ítem 3).

## `Repository.delete` con criterio anidado falla en `Prestamo`
- Detectado en: docs/ai/tasks/registrar-prestamo.md
- Fecha: 2026-08-12
- Descripción: `prestamoRepo.delete({ ruta: { id } })` falla ("Cannot find alias for relation") porque Prestamo tiene dos relaciones (cliente y ruta). La limpieza e2e usa query builder con columnas directas. Si el patrón se repite, evaluar un helper de borrado o documentar la limitación.
- Prioridad sugerida: baja

## Unicidad del teléfono de WhatsApp del cliente
- Detectado en: docs/ai/tasks/registrar-prestamo.md
- Fecha: 2026-08-12
- Descripción: el PRD no define unicidad para `clientes.telefono_whatsapp`. Decisión MVP: NO es único (se documenta); evaluar unicidad si se requiere evitar duplicados de cliente en HU-15/HU-19.
- Prioridad sugerida: baja

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
- Descripción: en `CobradoresService.setEstatus`, el `save` del cobrador y el `update` de rutas (`aplicarCascada`) no comparten transacción; si la cascada falla, el cobrador queda bloqueado con rutas activas sin rollback. Evaluar envolver ambos en una transacción (o al menos loguear el fallo de cascada para reconciliación). Se amplía a la cascada socio → cobradores → rutas (HU-05/HU-61).
- Prioridad sugerida: media
- Estado: **programada como Fase 0 del roadmap** (ítem 2).

## JwtAuthGuard no revalida el estado del admin por request
- Detectado en: docs/ai/tasks/matriz-permisos-socio.md (revisión code-reviewer)
- Fecha: 2026-08-11
- Descripción: `JwtAuthGuard` valida el token (tipo access) pero no consulta si el admin sigue activo por request: un admin bloqueado con access token vigente (15m) puede operar. Es un patrón pre-existente en todo el módulo. Evaluar revalidar `estado` del admin en el guard (o al menos al entrar en HU-07 cuando existan roles). Ahora es requisito de HU-05/HU-61 (bloqueo efectivo inmediato).
- Prioridad sugerida: media
- Estado: **programada como Fase 0 del roadmap** (ítem 1).

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
- Estado: **programada como Fase 0 del roadmap** (ítem 3, junto con assertOwned).

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

## RutasService.aplicarCascada queda como código muerto
- Detectado en: docs/ai/tasks/cascada-bloqueo.md (revisión code-reviewer PR #20)
- Fecha: 2026-08-17
- Descripción: al mover la cascada de rutas inline dentro de la transacción en `CobradoresService.setEstatus`, `RutasService.aplicarCascada` (y su spec) quedan sin consumidores. Removerlos o limpiarlos.
- Prioridad sugerida: baja

## Reactivar un socio reactiva cobradores bloqueados manualmente
- Detectado en: docs/ai/tasks/cascada-bloqueo.md (revisión code-reviewer PR #20)
- Fecha: 2026-08-17
- Descripción: `SociosService.setEstatus` reactiva todos los cobradores y rutas del socio; un cobrador bloqueado manualmente (mora individual/desvinculación, HU-05) se desbloquearía al reactivar el socio. Decisión de negocio a definir (registrar qué cobradores reactivar).
- Prioridad sugerida: media

## Falta e2e de la cascada socio → cobradores → rutas
- Detectado en: docs/ai/tasks/cascada-bloqueo.md (revisión code-reviewer PR #20)
- Fecha: 2026-08-17
- Descripción: existe e2e de cascada cobrador→rutas y de estatus de socio, pero no del flujo completo bloquear/reactivar socio → cobradores → rutas vía `PATCH /socios/:id/estatus`.
- Prioridad sugerida: media

## Falta test de rol desconocido en JwtAuthGuard
- Detectado en: docs/ai/tasks/revalidar-estado-jwt.md (revisión code-reviewer PR #18)
- Fecha: 2026-08-17
- Descripción: el guard es fail-closed ante rol desconocido (401), pero no hay test explícito que lo verifique. Agregar caso "rechaza un access token con rol desconocido".
- Prioridad sugerida: baja

## refresh no maneja el rol cobrador (futuro)
- Detectado en: docs/ai/tasks/revalidar-estado-jwt.md (revisión code-reviewer PR #18)
- Fecha: 2026-08-17
- Descripción: `AuthService.refresh` solo ramifica socio/admin; un refresh con rol cobrador caería en el bloque admin (401 por accidente, fail-closed). Al implementar el login del cobrador hay que ramificar cobrador aquí.
- Prioridad sugerida: baja (cuando exista login de cobrador)

## Asegurar que toda ruta con JwtAuthGuard tenga también PermisoGuard
- Detectado en: docs/ai/tasks/revalidar-estado-jwt.md (revisión code-reviewer PR #18)
- Fecha: 2026-08-17
- Descripción: un cobrador (futuro) que pase JwtAuthGuard sería rechazado por PermisoGuard (rol !== socio). Verificar que no exista ninguna ruta protegida solo con JwtAuthGuard sin PermisoGuard antes de habilitar el login del cobrador.
- Prioridad sugerida: media

## assertOwned del cobrador (por ruta.cobradorId) — futuro
- Detectado en: docs/ai/tasks/registrar-prestamo.md (revisión code-reviewer PR #17)
- Fecha: 2026-08-17
- Descripción: `assertOwned` solo contempla `rol === "socio"`. Al agregar el rol cobrador hay que definir la lógica de ownership del cobrador (validar contra `ruta.cobradorId`).
- Prioridad sugerida: media (cuando exista rol cobrador)

## Mock de DataSource innecesario en cartera.controller.spec
- Detectado en: docs/ai/tasks/registrar-prestamo.md (revisión code-reviewer PR #17)
- Fecha: 2026-08-17
- Descripción: `cartera.controller.spec.ts` provee `{ provide: DataSource, useValue: {} }` aunque `PrestamoService` se inyecta con useValue (el DataSource no se instancia). Inofensivo pero redundante; eliminarlo o documentarlo.
- Prioridad sugerida: baja

## ADR-0002 referencia HUs de la PR #19 (orden de merge)
- Detectado en: docs/ai/tasks/refactor-helpers.md (revisión code-reviewer PR #21)
- Fecha: 2026-08-17
- Descripción: el ADR de PostGIS cita HU-49/55/59 que existen en el PRD consolidado (PR #19, sin mergear). Asegurar que la PR #19 (docs) se mergee antes o junto para que las referencias sean válidas.
- Prioridad sugerida: baja

## ACCESO_DENEGADO duplicado con permiso.guard
- Detectado en: docs/ai/tasks/refactor-helpers.md (revisión code-reviewer PR #21)
- Fecha: 2026-08-17
- Descripción: al centralizar `ACCESO_DENEGADO` en `src/common/ownership.ts` queda una constante equivalente preexistente en `permiso.guard.ts`. Unificar en un futuro ítem de limpieza.
- Prioridad sugerida: baja

## Migración de coordenadas a PostGIS (geography(Point))
- Detectado en: sesión de revisión de producto (Agosto 2026)
- Fecha: 2026-08-17
- Descripción: `clientes` y `prestamos` usan `latitud`/`longitud` planos; para la Épica 7 (segmentación de trayectos, distancias) y la futura georreferenciación del cobrador se recomienda migrar a `geography(Point)` de PostGIS. Requiere ADR y afecta DTOs/servicios existentes. Programada como Fase 0 del roadmap (ítem 4).
- Prioridad sugerida: media

## Wiring de inyección+caja sin transacción
- Detectado en: docs/ai/tasks/caja-ruta.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `InyeccionesService.crear`/`eliminar` persisten la inyección y luego aplican el movimiento de caja en operaciones separadas; si `aplicarMovimiento` falla, la inyección queda persistida sin reflejar el saldo. Alinear con el patrón transaccional usado en la creación de ruta+caja (mismo ítem).
- Prioridad sugerida: media

## Concurrencia en pagos/abonos y saldo de caja sin lock
- Detectado en: docs/ai/tasks/registrar-pago-abono.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: el abono calcula la deuda fuera de transacción y el pago chequea `estatus` fuera de transacción; doble POST simultáneo puede duplicar pago/abono y doble crédito de caja. `caja.saldoActual` se actualiza sin `@Version` ni lock (lost update ante pagos concurrentes en la misma ruta; patrón ya existente en inyecciones). Evaluar `@Version` en `Caja` o lock pesimista para el MVP o Fase 2.
- Prioridad sugerida: media

## Abono que iguala la deuda deja el préstamo vigente con cuotas pendientes
- Detectado en: docs/ai/tasks/registrar-pago-abono.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: un abono que iguala exactamente la deuda deja el préstamo `vigente` con todas sus cuotas `pendiente` (deudaActual = 0, siguiente abono → 400) y no hay mecanismo que lo pase a `liquidado`. Consecuencia de la decisión "abono acumulado sin tocar estatus de cuotas". Evaluar transición a `liquidado` y el wiring de color de riesgo (HU-13) en HU-46 (ítem 8) o liquidación HU-20.
- Prioridad sugerida: media

## `esMetodoPagoValido` sin uso en producción
- Detectado en: docs/ai/tasks/registrar-pago-abono.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `esMetodoPagoValido` (metodo-pago.ts) está testeado pero sin uso en producción (los DTOs usan `IsIn`). Útil cuando exista validación en service; si no se usa, candidato a limpieza.
- Prioridad sugerida: baja

## `promesas_pago.conversacion_id` no modelado
- Detectado en: docs/ai/tasks/registrar-visita.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: la entidad `PromesaPago` no incluye `conversacion_id` (FK nullable) que el PRD 4.2:337-338 define. Coherente con promesas por IA fuera de alcance; se modelará cuando existan conversaciones de IA (HU-28/34, Fase 4).
- Prioridad sugerida: baja

## `tipoPago` default a abono cuando resultado=pago sin tipoPago
- Detectado en: docs/ai/tasks/registrar-visita.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `VisitasService` trata `resultado=pago` sin `tipoPago` como abono por defecto. Decisión a confirmar si es intencional o se exige `tipoPago` en el DTO.
- Prioridad sugerida: media

## `fechaPrometida` no valida que sea futura
- Detectado en: docs/ai/tasks/registrar-visita.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: una promesa con `fechaPrometida` en el pasado se registra como "pendiente" sin control. Decisión de negocio: rechazarla o permitir promesas ya vencidas.
- Prioridad sugerida: media

## `esMotivoNoPagoValido` sin uso en producción
- Detectado en: docs/ai/tasks/registrar-visita.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `esMotivoNoPagoValido` solo se usa en su spec; la validación real pasa por `@IsIn` del DTO. Útil para Fase 4 (IA); si no se usa, candidato a limpieza.
- Prioridad sugerida: baja

## Archivos huérfanos de evidencias ante fallo posterior al upload
- Detectado en: docs/ai/tasks/registrar-gasto.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: multer escribe los archivos antes de la validación de pipes y la transacción; si el DTO es inválido, la ruta no existe (404) o la transacción falla, los archivos quedan en `uploads/gastos` sin referencia ni limpieza. Evaluar `unlink` en catch o validación en el interceptor.
- Prioridad sugerida: media

## Actor Cobrador no alcanza gastos por API (HU-17)
- Detectado en: docs/ai/tasks/registrar-gasto.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `PermisoGuard` rechaza rol ≠ admin/socio; el Cobrador (nombrado en HU-17) no puede registrar/eliminar gastos por API. Consistente con el MVP (no hay login de cobrador), pero debe documentarse como limitación hasta el login del cobrador.
- Prioridad sugerida: baja

## Concurrencia sin lock en inyecciones y caja (patrón de gastos aplicado)
- Detectado en: docs/ai/tasks/registrar-gasto.md (revisión code-reviewer)
- Fecha: 2026-08-17
- Descripción: `inyecciones.service` (crear/eliminar) mantiene el patrón de lectura+escritura sin UPDATE condicional ni transacción para caja (mismo riesgo de doble descuento que tenían los gastos, ya corregido con UPDATE condicional). Aplicar el mismo patrón condicional a inyecciones.
- Prioridad sugerida: media

## Endpoint de descarga de evidencia de gasto pendiente
- Detectado en: docs/ai/tasks/registrar-gasto.md
- Fecha: 2026-08-17
- Descripción: las evidencias se persisten (disco + metadata) pero no hay endpoint GET para servir/descargar el archivo. Al implementarlo, controlar mimetype para evitar ejecución arbitraria (stored-XSS) dado el upload sin whitelist de contenido.
- Prioridad sugerida: media
