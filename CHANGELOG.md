# Changelog

Formato basado en [Conventional Commits](https://www.conventionalcommits.org/) y agrupado por versión siguiendo [SemVer](https://semver.org/lang/es/). Ver skill `github-gitflow-cicd` para el proceso de release.

## [Unreleased]

## [0.5.0] - 2026-08-19

### Added

- **Fase 2 — Reportes y liquidaciones (Épica 4)**:
  - **HU-20 — Generación de liquidación de ruta**: `POST /rutas/:id/liquidaciones` (gated por `generar_reporte`) que persiste un snapshot inmutable en `liquidaciones` (PRD 4.2:317, 17 campos) según el `periodo_liquidacion` configurado (diario/semanal/quincenal/mensual, agregado a `ruta_config` con default `diario`), con caja anterior/actual, estimado a cobrar, inyecciones activas, cobrado/prestado del periodo y del día, gastos aprobados, suma de cartera (cuotas pendientes/atrasadas − abonos) y comisión calculada sobre el total cobrado del periodo. Una por periodo (409 si ya existe la del vigente, respaldado por `Unique(ruta, periodo, fecha)`), transaccional y sin modificar la caja.
  - **HU-22/HU-50 — Historial de liquidaciones consultable y exportable**: `GET /rutas/:id/liquidaciones` (gated por `ver_reportes`) lista el historial de liquidaciones de la ruta (la liquidación diaria es el reporte diario); `GET /rutas/:id/liquidaciones/:id/export` (gated por `descargar_reporte`) descarga un `.xlsx` real generado con `exceljs` (nueva dependencia, MIT) con los campos de negocio de la liquidación.
  - **HU-51 — Detalle/resumen de ruta**: `GET /rutas/:id/resumen` (gated por `ver_reportes`) consolida el estado de la ruta (caja actual/anterior, fecha de última liquidación, gastos, cobrado/prestado del periodo, inyecciones, cartera vigente, préstamos activos, comisión y clientes), con visibilidad de campos sensibles controlada por los flags de `ruta_config` (`mostrarCaja`, `mostrarPrestamos`, `ocultarCartera`, `mostrarCobroEstimado`, `mostrarFechaUltimaLiquidada`) vía la función pura `aplicarVisibilidad` (`src/domain/resumen-ruta.ts`).
  - **Refactor**: `LiquidacionesService.calcularTotales(rutaId, inicio, fin, manager?)` centraliza las agregaciones (manager opcional) reutilizadas por la generación de liquidación y por el resumen de ruta, evitando duplicación.

### Tests

- Suite unitaria ampliada (42 suites / 386 tests) y e2e (27 suites / 209 tests sobre Postgres real), incluyendo e2e nuevos de liquidación (6), historial/exportación a Excel (5) y detalle de ruta (4). Dependencia nueva `exceljs` (^4.4.0).

### Docs

- Archivos de tarea en `docs/ai/tasks/` (liquidacion-ruta, historial-liquidaciones, detalle-ruta) y backlog ampliado (pagos huérfanos en liquidación, `ver_cartera` del cobrador).

## [0.4.0] - 2026-08-19

### Added

- **Fase 0 — Cimientos**:
  - **HU-05/HU-61 — Revalidar estado del usuario en cada request**: `JwtAuthGuard` vuelve a consultar el estado activo/bloqueado (admin/socio) en cada petición autenticada, haciendo efectivo el bloqueo de inmediato.
  - **HU-05/HU-61 — Cascada de bloqueo en transacción**: al bloquear/activar un Socio se bloquean/activan en cascada sus Cobradores y sus Rutas (transaccional); al cambiar el estatus de un Cobrador se propagan sus Rutas.
  - **Refactor — Helpers compartidos**: `assertOwned` (ownership) y `numericTransformer` extraídos a `src/common/` y reutilizados por los servicios existentes.
  - **ADR PostGIS — Migrar coordenadas a `geography(Point)`**: `clientes.ubicacion` migrado a `geography(Point)` con índice GIST; se eliminó `lat/lng` de `prestamos` (usa la ubicación del negocio del cliente). Helpers `toPoint`/`fromPoint`.
- **Fase 1 — Núcleo operativo de cartera (Épica 3)**:
  - **HU-14 — Registro de cliente y préstamo ampliado**: cliente con dos direcciones (negocio obligatoria y domicilio opcional), fotos facial/documento según flags, tope de deuda propio, `tipo_interes`/`dias_entre_cuotas` por préstamo, fiador opcional, fecha del préstamo editable ±30 días y generación transaccional de cuotas respetando el cupo.
  - **HU-13/HU-15/HU-16 — Regla de días de cobro y mora**: al generar cuotas se ajusta el vencimiento al siguiente día hábil (`dias_no_laborables` de `ruta_config`) y un job diario (`@nestjs/schedule`) marca como `atrasada` las cuotas desde el día siguiente al vencimiento, alimentando el color de riesgo.
  - **HU-08/HU-11 — Caja de ruta**: entidad `caja` 1:1 con saldo inicial obligatorio, saldo vivo persistido, `caja_ajustes_log` con auditoría, `GET /rutas/:id/caja` (gated por `ver_reportes`) y wiring con inyecciones.
  - **HU-15 — Pago de cuota y abono**: `POST /rutas/:id/pagos` y `/abonos` (gated por `configurar_ruta`), método de pago obligatorio (efectivo/QR/transferencia/tarjeta/depósito), actualización transaccional de caja y validación de deuda.
  - **HU-46/HU-16 — Registro de visita**: `POST /rutas/:id/visitas` con resultado pago/no_pago, catálogo de motivos de no pago, promesa de pago por "compromiso de pago" y composición con pago/abono (visitaId).
  - **HU-17 — Gastos de ruta con evidencias**: `POST`/`PATCH`(aprobar)/`DELETE /rutas/:id/gastos[/:gastoId]` con evidencias (imágenes/PDF vía multer), flujo de aprobación, trazabilidad de creador y wiring transaccional de caja.
  - **HU-47 — Actualización de cliente con aprobación**: `PATCH /rutas/:id/clientes/:clienteId` aplica el cambio directo si hay permiso, o genera una propuesta pendiente que un Admin/Socio dueño aprueba o rechaza (auditable) vía `PATCH .../cambios-cliente/:cambioId/decision`.
  - **HU-48 — Gestión de cuotas y abonos con auditoría**: `PATCH`/`DELETE /rutas/:id/cuotas/:cuotaId` (incluyendo pagadas, con ajuste/reversión de caja y sincronización del pago) y `DELETE /rutas/:id/abonos/:abonoId`, registrando cada operación en `auditoria_cartera` (valores antes/después, actor, motivo) y exigiendo re-autenticación de contraseña del operador. `pagos.cuota_id` pasó a nullable (`SET NULL`) para conservar el pago al eliminar una cuota.
  - **HU-45 — Notas de ruta**: `POST/GET/PATCH/DELETE /rutas/:id/notas[/:notaId]` (gated por `anotar_notas_ruta`, agregado a las matrices de socio y cobrador), entidad `ruta_notas` con `creado_por_rol/id` y `created_at`/`updated_at`; borrado físico y sin historial de ediciones.

### Tests

- Suite unitaria ampliada (38 suites / 350 tests) y e2e (24 suites / 194 tests sobre Postgres real), incluyendo e2e nuevos de gastos, visitas, pagos/abonos, cuotas/abonos con auditoría, notas de ruta y flujo de aprobación de cliente.

### Docs

- Archivos de tarea por HU en `docs/ai/tasks/` (Fase 0 y Fase 1: ítems 5-13) y ADR PostGIS (0002); backlog ampliado (concurrencia en caja, préstamo/color de riesgo, visita tras eliminar abono, etc.).

## [0.3.0] - 2026-08-12

### Added

- **HU-08 — Registro de rutas**: `POST /rutas` (gated por `registrar_ruta`) con validaciones (404 socio/cobrador inexistentes, 409 si bloqueados, interés > 0, moneda ISO) y ownership; **cascada de bloqueo de rutas** al bloquear/activar un cobrador (diferida de HU-05); `PATCH /rutas/:id/estatus` (reactivación manual) y `PATCH /rutas/:id/cobrador` (reasignación).
- **HU-09 — Editar nombre/descripción de ruta**: `PATCH /rutas/:id` (gated por `configurar_ruta`) que solo toca metadata, dejando intacta la configuración operativa.
- **9a — Editar configuración de ruta**: `PATCH /rutas/:id/configuracion` para `tipoInteres`/`numCuotas`; la `moneda` NO es editable (decisión, evita mezclar monedas en estadísticas).
- **HU-10 — Matriz `ruta_config`**: `GET`/`PUT /rutas/:id/ruta-config` con los 25 parámetros de la APK del cobrador (visibilidad, cupo, comisión, permisos de borrado, etc.), defaults conservadores y PUT de reemplazo total.
- **HU-11 — Inyecciones de capital**: `POST /rutas/:id/inyecciones` (valor > 0 + comentario obligatorio), estado `activa` y timestamp.
- **HU-12 — Eliminar inyección con trazabilidad**: `DELETE /rutas/:id/inyecciones/:inyeccionId` como **soft-delete** (`estado = eliminada`) conservando el registro y su `fecha_hora` (snapshot inmutable, PRD 4.3).
- **HU-13 — Color de riesgo por cliente**: regla pura `calcularColorRiesgo` (`src/domain/`, azul/rojo/blanco, umbral inclusivo desde `ruta_config`); el wiring con `clientes`/`cuotas` se difiere a HU-14/15.

### Tests

- Suite unitaria (186 tests) y e2e (126 tests sobre Postgres real) cubriendo la Épica 2. Se fijó ejecución serial de e2e (`testTimeout`/`maxWorkers: 1`) por flakiness de pools paralelos.

### Docs

- Archivo de tarea por HU en `docs/ai/tasks/` (HU-08 a HU-13, 9a) y backlog ampliado (desviación `prestamos.tipo_interes`, moneda no editable, `assertOwned`/`numericTransformer` duplicados, transaccionalidad de la cascada).

## [0.2.0] - 2026-08-12

### Added

- **HU-01 — Login de administrador**: `POST /auth/login` con bcrypt, JWT de corta duración + refresh rotado, `JwtAuthGuard`, `HttpsGuard` (TLS por entorno) y seed del primer admin desde `.env`. Infraestructura local: docker-compose con postgis, conexión TypeORM y fail-fast de variables de entorno.
- **HU-02 — Registro de socios**: `POST /socios` con validación (contraseña ≥ 8, correo/teléfono/moneda ISO 4217), unicidad global (usuario/codigo/correo/teléfono) y respuesta sin `passwordHash`.
- **HU-03 — Registro de cobradores**: `POST /cobradores` asociado obligatoriamente a un socio existente (404 si no existe, 409 si el socio está bloqueado), unicidad global y FK con `ON DELETE RESTRICT`.
- **HU-04 — Edición de socio/cobrador**: `PATCH /socios/:id` y `PATCH /cobradores/:id` (perfil + contraseña re-hasheada) sin exponer nunca la contraseña anterior.
- **HU-05 — Bloqueo/activación**: `PATCH /socios/:id/estatus` y `PATCH /cobradores/:id/estatus`, idempotentes, con punto de integración de cascada de rutas (se cablea en HU-08).
- **HU-06 — Matriz de permisos por socio**: `GET`/`PUT /socios/:id/permisos` con el catálogo de 20 permisos del PRD, reemplazo total transaccional y ausencia de fila = deshabilitado.
- **HU-07 — Acceso del socio por permisos**: `POST /auth/socio/login`, rol `admin|socio` en el JWT, refresh rol-aware, `PermisoGuard`/`@PermisoRequerido` (admin bypass, socio necesita el permiso, 403 si no) y ownership cross-socio (un socio solo opera sobre sus propios recursos).
- **Extensión aprobada — Matriz de permisos de cobrador** (`cobrador_permisos`, catálogo de 12): gestionada por el socio con `editar_permisos` sobre sus colaboradores (`GET /cobradores` filtrado + `GET`/`PUT /cobradores/:id/permisos` con ownership). Desviación explícita del PRD 4.2 registrada en `docs/ai/tasks/acceso-socio-permisos.md`.
- **CI/CD**: pipeline con lint, typecheck, tests unitarios con cobertura, job e2e sobre Postgres real y escaneo de secretos (gitleaks). Reglas de commit + PR por HU (GitFlow) en `AGENTS.md`.

### Tests

- Suite unitaria (121 tests) y e2e (69 tests sobre Postgres real) cubriendo los flujos de las 7 historias.

### Docs

- Roadmap de historias (`docs/plan-feature-roadmap.md`) y archivo de tarea por HU en `docs/ai/tasks/`.
