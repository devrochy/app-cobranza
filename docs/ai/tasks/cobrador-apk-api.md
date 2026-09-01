# Tarea: cobrador-apk-api (controller del cobrador para la APK)

- **Origen:** Plan del APK del cobrador (Paso 1, Enfoque A) aprobado por el usuario 2026-08-31. Requiere la infra de `acceso-cobrador-dominio` (#76, ya en develop).
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Exponer un controller `GET/POST /cobrador/...` para la APK (modo en línea) que compone los servicios de dominio existentes, autenticado con `JwtAuthGuard` (rol cobrador + estatus) y `CobradorPermisoGuard` (matriz `cobrador_permisos`), con ownership por `ruta.cobradorId` vía `assertOwned` de los servicios.

## Fuera de alcance
- Offline/sincronización (device key) y aplicar eventos al dominio → tareas `aplicar-offline-dominio` / repo APK.
- Reportes, liquidaciones, notas, eliminar cosas desde la APK (futuro).

## Endpoints
1. `GET /cobrador/mis-rutas` (`ver_cartera`) → rutas del cobrador con `config` (ruta_config) y `permisos` (cobrador_permisos).
2. `GET /cobrador/rutas/:rutaId/dia` (`ver_cartera`) → clientes del día + trayecto planificado (o null).
3. `POST /cobrador/rutas/:rutaId/visitas/pago` (`registrar_pago`) → visita `resultado:"pago"`.
4. `POST /cobrador/rutas/:rutaId/visitas/no-pago` (`registrar_no_pago`) → visita `resultado:"no_pago"` (+ promesa).
5. `POST /cobrador/rutas/:rutaId/gastos` (`registrar_gasto`) → gasto con evidencias (multipart).
6. `POST /cobrador/rutas/:rutaId/trayectoria-real` (`generar_reporte`) → trayectoria GPS.
7. `GET /cobrador/rutas/:rutaId/clientes/:clienteId/tarjeta` (`ver_cartera`) → estado de cuenta.
8. `GET /cobrador/rutas/:rutaId/clientes/:clienteId/prestamos` (`ver_cartera`) → préstamos con cuotas (id incl.) del cliente (la APK necesita `cuotaId` para registrar pagos).

## Bloques (checklist TDD)
- [x] Bloque 1: `CobradorService.misRutas(cobradorId)` — lista rutas por `cobradorId`, compone config + permisos. Orden de rutas por id. Si sin rutas → array vacío.
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts`
- [x] Bloque 2: `CobradorService.dia(rutaId, requester)` — compone `ListaClientesDelDiaService.obtener` + `RutaOptimizacionService.consultar` (trayecto tolerante a ausencia → null). Delegaciones con requester cobrador.
  - Test(s): `src/modules/cobrador/cobrador.service.spec.ts`
- [x] Bloque 3: `CobradorController` (thin) con los 7 endpoints + DTOs reutilizados (`RegistrarVisitaDto`, `RegistrarGastoDto`, `RegistrarTrayectoriaRealDto`); `FilesInterceptor` para gastos; `resultado` fijado por endpoint de visita.
  - Test(s): `src/modules/cobrador/cobrador.controller.spec.ts`
- [x] Bloque 4: `CobradorModule` (importa CarteraModule/RutasModule/CobradoresModule/AuthModule; registra Ruta) + registro en AppModule. Exports nuevos de `CarteraModule` (`VisitasService`, `ClienteTarjetaService`).
  - Test(s): boot implícito en e2e; typecheck.
- [x] Bloque 5: e2e `cobrador-apk.e2e-spec.ts` — login cobrador → mi-ruta (config+permisos) → dia → visita pago → gasto → trayectoria → tarjeta; scope: ruta ajena → 403; sin permiso → 403.
  - Test(s): `test/e2e/cobrador-apk.e2e-spec.ts` (9 tests)

## Decisiones tomadas durante la implementación
- Un cobrador puede tener varias rutas (sin unique en `cobrador_id`) → endpoints de operación usan `:rutaId`; ownership lo valida `assertOwned` en los servicios (403 si no es su ruta).
- `GET /cobrador/mis-rutas` consulta `Ruta` por la relación `cobrador: { id }` (un `@RelationId` NO es consultable en `where` — `cobradorId` da "Property not found"; desviación del borrador).
- DTOs reutilizados de cartera/rutas (una sola fuente de verdad); la visita fija `resultado` por endpoint para mapear 1:1 con `registrar_pago`/`registrar_no_pago`.
- `dia` tolera ausencia de trayecto planificado (null) como el snapshot de sync-offline.
- E2E: cleanup global en orden FK (evidencias→gastos→pagos→abonos→promesas→visitas→cuotas→préstamos→clientes→logs→reportes→caja→rutas). Dejar hijos huérfanos rompía el borrado global de specs posteriores (FK).
- Revisión code-reviewer APROBADA: quick-wins aplicados — `misRutas` hoistea `getMatriz(cobradorId)` fuera del loop (evita N+1); e2e borra `promesas_pago` antes que `visitas`. Notas documentadas: `dia` consulta el trayecto 2 veces (una dentro de `ListaClientesDelDiaService.obtener` que traga errores y otra en `consultarTrayecto` que propaga — comportamiento defendible, falla ruidoso); el DTO `RegistrarVisitaDto` exige `resultado` aunque el endpoint lo sobreescribe (documentar en el contrato de la APK: el cliente debe enviarlo); casos borde sin test directo → backlog.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿base? → Respuesta: "Mergear #76 primero".

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (unit) y `scripts/test-e2e.sh` verde (362 e2e, 52 suites — 9 nuevos de cobrador-apk).
- Archivos modificados:
  - `src/modules/cobrador/` (nuevo): `cobrador.module.ts`, `cobrador.service.ts` (+spec, 8 tests), `cobrador.controller.ts` (+spec, 7 tests).
  - `src/modules/cartera/cartera.module.ts` — exporta `VisitasService`, `ClienteTarjetaService`.
  - `src/app.module.ts` — registra `CobradorModule`.
  - `test/e2e/cobrador-apk.e2e-spec.ts` (nuevo, 9 tests).
  - `docs/ai/tasks/cobrador-apk-api.md` (este archivo).
- Pendientes/seguimiento: repo APK (Expo) consumiendo estos endpoints; offline/sync (`aplicar-offline-dominio`).