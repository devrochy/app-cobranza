# Tarea: acceso-cobrador-dominio (infraestructura de autorización del cobrador)

- **Origen:** Plan del APK del cobrador (Paso 1) aprobado por el usuario 2026-08-31; enfoque A (controller de operación del cobrador) elegido en brainstorming. Esta tarea es la infraestructura; la API de endpoints es `cobrador-apk-api`.
- **Estado:** en progreso
- **Fecha inicio:** 2026-08-31

## Objetivo
Que el rol `cobrador` pueda ser autorizado por su matriz `cobrador_permisos` en `PermisoGuard`, que `assertOwned` valide su ownership por `ruta.cobradorId`, y que la ruta insegura `whatsapp-simulado` deje de ser alcanzable por cobradores.

## Fuera de alcance (siguiente tarea `cobrador-apk-api`)
- Controller del cobrador y sus endpoints (mi-ruta, dia, visitas, gastos, trayectoria-real, tarjeta).

## Bloques (checklist TDD)
- [x] Bloque 1: `CobradoresPermisosService.tienePermiso(cobradorId, permiso)` (espejo de `PermisosSocioService.tienePermiso`).
  - Test(s): `src/modules/cobradores/cobradores-permisos.service.spec.ts`
- [x] Bloque 2: `CobradorPermisoGuard` + `CobradorPermisoRequerido` (rol cobrador + permiso en `cobrador_permisos`; sin permiso → 403). Exportado desde `AuthModule`.
  - Test(s): `src/modules/auth/cobrador-permiso.guard.spec.ts`
- [x] Bloque 3: `assertOwned` valida cobrador contra `ruta.cobradorId` (admin/socio sin cambio).
  - Test(s): `src/common/ownership.spec.ts`
- [x] Bloque 4: `whatsapp-simulado` pasa a admin-only (`PermisoGuard` sin `@PermisoRequerido`); auditoría de rutas con `JwtAuthGuard` sin `PermisoGuard`.
  - Test(s): e2e completos verdes (353). `conversaciones-socio` queda protegido por `verificarAcceso` (rechaza cobrador). Nuevo e2e: cobrador → 403 en `POST /whatsapp/simulado/recibir`.

## Decisiones tomadas durante la implementación
- **PIVOTE**: NO se extendió `PermisoGuard` (rompía el wiring: `CobradoresModule` importa `RutasModule`, que usa `PermisoGuard`, → ciclo; y los módulos web no podrían resolver `CobradoresPermisosService`). En su lugar se creó **`CobradorPermisoGuard`** dedicado, exportado por `AuthModule`: aísla la superficie del APK y no toca la autorización web existente (más seguro y escalable).
- `whatsapp-simulado`: admin-only (webhook simulado de Fase 1; los e2e lo usan con token admin).
- Auditoría de rutas: solo `conversaciones-socio` (`obtener`/`enviar`) queda sin `PermisoGuard`, pero `verificarAcceso` rechaza `rol === "cobrador"` → seguro.

## Ambigüedades resueltas con el usuario
- Pregunta: ¿superficie? → Respuesta: "lo que me recomiendes, completo, mantenible y escalable" → Enfoque A + set operativo MVP.

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (767 unit, 88 suites) + `scripts/test-e2e.sh` verde (353 e2e, 51 suites).
- Archivos modificados:
  - `src/modules/cobradores/cobradores-permisos.service.ts` (+`tienePermiso`) y su spec (+2 tests).
  - `src/modules/auth/cobrador-permiso.guard.ts` (nuevo), `cobrador-permiso-requerido.decorator.ts` (nuevo), `cobrador-permiso.guard.spec.ts` (nuevo, 5 tests).
  - `src/modules/auth/auth.module.ts` — provee y exporta `CobradorPermisoGuard`; importa `CobradoresModule`.
  - `src/common/ownership.ts` (+check cobrador) y `ownership.spec.ts` (+3 tests).
  - `src/modules/cartera/whatsapp-simulado.controller.ts` — admin-only.
  - `docs/ai/tasks/acceso-cobrador-dominio.md` (este archivo).
- Pendientes/seguimiento: controller del cobrador (`cobrador-apk-api`) con endpoints mi-ruta/dia/visitas/gastos/trayectoria/tarjeta, reutilizando `CobradorPermisoGuard` + `assertOwned` cobrador.