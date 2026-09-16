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

## Moneda de ruta no editable (decisión de producto)
- Detectado en: docs/ai/tasks/editar-nombre-ruta.md
- Fecha: 2026-08-12
- Descripción: la `moneda` de una ruta NO es editable tras el registro (decisión del usuario) para evitar mezclar monedas en estadísticas/liquidaciones. La edición de configuración de ruta cubre solo tipoInteres y numCuotas (nueva HU 9a en el roadmap).
- Prioridad sugerida: media

## Unicidad de correo case-insensitive
- Detectado en: docs/ai/tasks/editar-socio-cobrador.md (revisión code-reviewer)
- Fecha: 2026-08-11
- Descripción: la unicidad de `correo` (socios/cobradores) es case-sensitive por default en Postgres: `Correo@x.com` y `correo@x.com` pueden coexistir. Considerar normalizar a minúsculas al crear/editar (afecta create y update de ambos módulos).
- Prioridad sugerida: media

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

## Asegurar que toda ruta con JwtAuthGuard tenga también PermisoGuard
- Detectado en: docs/ai/tasks/revalidar-estado-jwt.md (revisión code-reviewer PR #18)
- Fecha: 2026-08-17
- Descripción: un cobrador (futuro) que pase JwtAuthGuard sería rechazado por PermisoGuard (rol !== socio). Verificar que no exista ninguna ruta protegida solo con JwtAuthGuard sin PermisoGuard antes de habilitar el login del cobrador.
- Prioridad sugerida: media

## Mock de DataSource innecesario en cartera.controller.spec
- Detectado en: docs/ai/tasks/registrar-prestamo.md (revisión code-reviewer PR #17)
- Fecha: 2026-08-17
- Descripción: `cartera.controller.spec.ts` provee `{ provide: DataSource, useValue: {} }` aunque `PrestamoService` se inyecta con useValue (el DataSource no se instancia). Inofensivo pero redundante; eliminarlo o documentarlo.
- Prioridad sugerida: baja

## Casos borde de la API del cobrador sin test directo (endurecimiento)
- Detectado en: docs/ai/tasks/cobrador-apk-api.md (revisión code-reviewer)
- Fecha: 2026-08-31
- Descripción: la API `/cobrador` cubre flujo feliz + 403 ownership + 403 permiso, pero no tests directos de: gasto con mimetype inválido (400), gastos sin archivos (201, `files ?? []`), trayectoria-real con <2 puntos (400 por `ArrayMinSize`), tarjeta de cliente de otra ruta (404), `mis-rutas` sin `ver_cartera` (403), 401 sin token. Cubiertos por la lógica existente (DTOs/servicios/guards), pero conviene endurecer.
- Prioridad sugerida: baja
- Estado: pendiente.

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

## Duplicación del patrón de upload (evidencias/fotos)
- Detectado en: docs/ai/tasks/ampliar-registro-cliente.md (revisión code-reviewer)
- Fecha: 2026-08-18
- Descripción: `cliente-foto-upload.ts` duplica la estructura de `evidencia-upload.ts` (diskStorage + fileFilter + limits). Extraer una fábrica compartida (mimetypes/dir como parámetros) en un ítem de limpieza.
- Prioridad sugerida: baja

## Cobertura e2e faltante de autorización/flags en ampliación de cliente
- Detectado en: docs/ai/tasks/ampliar-registro-cliente.md (revisión code-reviewer)
- Fecha: 2026-08-18
- Descripción: sin e2e para 403 socio sin configurar_ruta en clientes/préstamos, flag fecha false → 400, foto documento obligatoria → 400, mimetype inválido → 400. Cubiertos en unitarios; agregar e2e si se refuerza.
- Prioridad sugerida: baja

## Visita queda como "pago" tras eliminar el abono (HU-48)
- Detectado en: docs/ai/tasks/gestion-cuotas-abonos.md (revisión code-reviewer)
- Fecha: 2026-08-18
- Descripción: `AbonosService.eliminarAbono` elimina el abono físicamente (con auditoría y reversión de caja) pero no toca la `visita` asociada (via `abonos.visita_id`), que conserva `resultado: "pago"` y `valorPagado`. Un reporte de visitas mostraría un pago que ya no existe. Decidir si la visita debe reflejar la reversión o documentar que conserva el dato histórico.
- Prioridad sugerida: baja

## ver_cartera en catálogo del cobrador vs. ver_reportes en resumen de ruta (HU-51)
- Detectado en: docs/ai/tasks/detalle-ruta.md (implementación HU-51)
- Fecha: 2026-08-19
- Descripción: `ver_cartera` solo existe en `COBRADOR_PERMISOS` (PRD:264); HU-51 actores son Admin/Socio y el endpoint `GET /rutas/:id/resumen` queda gated por `ver_reportes`. Cuando exista login de cobrador, evaluar si `ver_cartera` debe controlar la visibilidad restringida de cartera para el cobrador.
- Prioridad sugerida: baja (hasta login de cobrador)
## Extraer helper compartido de coordenadas geography (ST_Y/ST_X con ::geometry)
- Detectado en: docs/ai/tasks/mapa-clientes-dia.md (revisión code-reviewer HU-57)
- Fecha: 2026-08-19
- Descripción: el patrón `ST_Y(c.ubicacion::geometry)`/`ST_X(c.ubicacion::geometry)` se repite en `ruta-optimizacion.service.ts` (clientes del día) y `lista-clientes-dia.service.ts` (coordenadas de markers). Evaluar un helper compartido en `src/common/geo.ts` para centralizar la extracción de coordenadas desde geography.
- Prioridad sugerida: baja
## fechaLocal duplicado en varios servicios (HU-49)
- Detectado en: docs/ai/tasks/trayectorias-reporte.md (revisión code-reviewer HU-49)
- Fecha: 2026-08-19
- Descripción: `fechaLocal` se repite en `trayectorias.service.ts`, `ruta-optimizacion.service.ts`, `liquidaciones.service.ts`, etc. Extraer un helper común.
- Prioridad sugerida: baja

## ver_reportes en POST de trayectoria-real (HU-49)
- Detectado en: docs/ai/tasks/trayectorias-reporte.md (revisión code-reviewer HU-49)
- Fecha: 2026-08-19
- Descripción: el POST /rutas/:id/dia/trayectoria-real usa `ver_reportes` (lectura) para una escritura; el patrón del proyecto usa `generar_reporte` en POSTs. Evaluar cambiar el permiso.
- Prioridad sugerida: baja

## Extraer helper compartido de construcción de fila de auditoría
- Detectado en: docs/ai/tasks/promesas-auditables.md (revisión code-reviewer HU-34)
- Fecha: 2026-08-21
- Descripción: la fila de `auditoria_cartera` (entidad, operacion, valoresAntes/Despues, actor, motivo) se construye a mano en tres servicios (cuota.service, abonos.service, promesas-pago.service). Extraer un helper compartido para evitar el tercer lugar duplicado.
- Prioridad sugerida: baja

## Test de fechas de cuotas dependiente de zona horaria (prestamo.service.spec)
- Detectado en: docs/ai/tasks/socio-dashboard.md (check.sh previo a merge)
- Fecha: 2026-09-06
- Descripción: `prestamo.service.spec.ts:292` compara `fechaVencimiento.getTime() - fechaOtorgado.getTime()` con `7*86400000` exacto; falla en máquinas con zona horaria distinta a UTC (DST). Flaky/pre-existente, ajeno al cambio de dashboard. Normalizar las fechas a UTC o usar diferencia en días.
- Prioridad sugerida: baja

## Traducir la regla de "cobro HOY" a SQL compartido y validar geometrías en el trayecto
- Detectado en: docs/ai/tasks/trayecto-optimo-filtro-y-origen.md (review code-reviewer, 2026-09-08)
- Descripción:
  1. La cláusula HAVING de "cobro HOY" quedó duplicada entre `RutaOptimizacionService.obtenerClientesDelDia` (ruta-optimizacion.service.ts) y `ListaClientesDelDiaService.listarClientesConEstado` (lista-clientes-dia.service.ts). Si la regla cambia, un lugar puede quedar desincronizado silenciosamente. Extraerla a un builder/constante SQL compartida.
  2. "Riesgo de recursión infinita en `subdividir`/`kMeans` (segmentacion-trayectos.ts)": con >= maxParadas+1 paradas con coordenadas idénticas y maxParadas=9, kMeans colapsa a 1 grupo (empate al primer centroide) y `subdividir` se auto-recurre con el mismo grupo → stack overflow. Caso realista: clientes en el mismo edificio.
  3. `c.ubicacion IS NOT NULL` no garantiza geometría casteable: `ST_Y/ST_X(c.ubicacion::geometry)` puede fallar con geometry malformado y coordenadas (0,0) entran como paradas válidas. Validar con `ST_IsValid`/rango de coords o manejar el fallo de cast. La misma precondición existe en `ListaClientesDelDiaService.coordenadasDeClientes`.
  4. `fechaLocal` está duplicado en ruta-optimizacion.service.ts y lista-clientes-dia.service.ts; extraer a util compartido.
- Prioridad sugerida: media (1,2,4), baja (3)

## Vinculación autoservicio de dispositivo (HU-39/43) — PREREQUISITO DE PRODUCCIÓN
- Detectado en: docs/ai/tasks/apk-autovinculacion-dispositivo.md (decisión de diseño Épica 8, 2026-09-11)
- Fecha: 2026-09-15
- Descripción: en el MVP el login de cobrador no exige device vinculado, lo que en producción permitiría entrar desde cualquier equipo con las credenciales. Falta el flujo autoservicio: la APK se auto-registra (`POST /cobrador/dispositivo` con Android ID + WhatsApp + publicKey X25519, queda `pendiente_revalidacion`) y el admin aprueba (`PATCH /devices/:id/aprobar`). Requiere además exponer `telefono` en login/perfil y alertar al admin.
- Decisiones abiertas: ¿vinculación bloqueante hasta aprobar?, origen de la clave X25519 (backend vs APK), WhatsApp prellenado o manual, y gate del primer release a producción.
- Prioridad sugerida: **alta (bloqueante de producción)**.

---

## Resueltos (historial)

- **Rate limiting de login** y **blacklist/revocación de refresh tokens** → `seguridad-auth` (PR #116): throttle 5/min por IP en los 3 login + `RefreshTokenRevocado` + `POST /auth/logout`.
- **Wiring de inyección+caja sin transacción**, **concurrencia en pagos/abonos y saldo de caja sin lock** y **concurrencia sin lock en inyecciones y caja** → `robustez-financiera` (PR #118): locks pesimistas, transacciones y UPDATEs condicionales + `affected` en eliminaciones.
- **Endpoint de descarga de evidencia de gasto** y **de foto/evidencia de cliente** → `descarga-evidencias` (PR #115): `GET /rutas/:id/gastos/:gastoId/evidencias/:evidenciaId` y `GET /rutas/:rutaId/clientes/:clienteId/evidencias/:tipo` (mimetype controlado).
- **Fase 0 del roadmap** → `revalidar-estado-jwt` (#18), `cascada-bloqueo` (#20), `refactor-helpers` (#21), `postgis-migracion` (#22): revalidación de estado en el guard, transacción en la cascada socio→cobradores→rutas, helpers `assertOwned`/`numericTransformer`, migración a PostGIS `geography(Point)`.
- **`prestamos.tipo_interes`** → agregado a la entidad (HU-14): los préstamos cierran su propia tasa.
- **`refresh` con rol cobrador** → `auth.service.ts` ahora ramifica socio/cobrador/admin.
- **`assertOwned` del cobrador** → `src/common/ownership.ts` valida `ruta.cobradorId` para rol cobrador.
- **Actor Cobrador en gastos (HU-17)** → `POST /cobrador/rutas/:rutaId/gastos` con `CobradorPermisoRequerido("registrar_gasto")`.
- **`whatsapp-simulado` sin `PermisoGuard`** → el controller es admin-only (`@UseGuards(JwtAuthGuard, PermisoGuard)`).
- **ADR-0002 con HUs de la PR #19** → PR #19 (PRD consolidado v1.1) mergeada; referencias válidas.
- **Pago conserva valor histórico** → resuelto en la implementación (`CuotaService.editarCuota` actualiza `pago.valor` con el ajuste de caja).
- **Helper `isUniqueViolation`** → `p4-deuda-tecnica`: extraído a `src/common/db-errors.ts` (4 copias eliminadas).
- **`RutasService.aplicarCascada` código muerto** → `p4-deuda-tecnica`: eliminado (más su spec).
- **`esMetodoPagoValido` / `esMotivoNoPagoValido` sin uso** → `p4-deuda-tecnica`: eliminados (más sus tests).
- **`ACCESO_DENEGADO` duplicado** → `p4-deuda-tecnica`: única fuente en `src/common/ownership.ts`; guards y controller lo importan de allí.
- **Observabilidad avanzada** (OpenTelemetry + métricas Prometheus + redacción de sensibles) → `p4-observabilidad` (PR #132): `/metrics`, tracing env-gated y `redactarSensibles`.
- **Race condition TOCTOU en `decidirPropuesta` (HU-47)** → `p0-concurrencia`: UPDATE condicional `WHERE estado='pendiente'`.
- **`registrarReal` de trayectoria no transaccional** y **consolidación de trayectorias sin filtrar por día (HU-49)** → `p0-concurrencia`: transacción + `manager` + filtro por fecha.
- **`eliminarAbono` no valida `liquidado`**, **abono que iguala la deuda deja el préstamo vigente** y **semántica del tope de deuda** → `p0-reglas-financieras`: rechazo, liquidación al saldar y cupo con el total con interés.
- **Archivos huérfanos de evidencias ante fallo posterior al upload** → `p0-evidencias-huerfanas`: `eliminarArchivosSubidos` (gastos y clientes).
- **Liquidación: pagos huérfanos (cuota_id NULL) (HU-20)** → `p0-reglas-financieras`: se prohíbe eliminar una cuota pagada y `eliminarPago` reabre la cuota.
- **E2E `reglas-negociacion-ia` flaky por estado compartido** → `p1-cierre-qa`: test autocontenido (hace su propio `PUT`).
- **Color de riesgo desactualizado tras pagos/eliminaciones/mora** → `color-riesgo-recalculo` (PR #127): `ColorRiesgoService` + wiring y limpieza de datos.
- **Borrado de pago de cuota desde el panel** (permiso `eliminar_pago` + `pago` por cuota en estado de cuenta) → `eliminar-pago-panel` (PR #126).
- **`linkPago` en el listado de cobros-socio** → `link-pago-socio` (PR #119).
