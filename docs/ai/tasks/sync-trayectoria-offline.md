# Tarea: sync-trayectoria-offline (evento trayectoria en la sync offline)

- **Origen:** Plan aprobado del usuario para dejar la APK desarrollada (Fase 4a, 2026-09-01). HU-49/64 (docs/APP_REQUIREMENTS.md:66,128): trayectoria GPS real offline.
- **Estado:** completada
- **Fecha inicio:** 2026-09-02
- **Fecha cierre:** 2026-09-02

## Objetivo
Que la trayectoria GPS registrada sin conexión se sincronice vía `POST /sync-offline/eventos` como evento `trayectoria` y se aplique al dominio (`TrayectoriasService.registrarReal`), permitiendo auditar el recorrido real del día (HU-49).

## Fuera de alcance
- Encolado de la trayectoria en la APK (tarea `apk-trayectoria-offline` en el repo app-cobranza-apk).

## Bloques (checklist TDD)
- [x] Bloque 1: catálogo `TIPO_EVENTO_SYNC` + `trayectoria`; DTO `RegistrarTrayectoriaRealDto`; permiso `generar_reporte`.
  - Test(s): `src/modules/sincronizacion-offline/aplicar-eventos-offline.service.spec.ts` (+3).
- [x] Bloque 2: `aplicarUno` → `TrayectoriasService.registrarReal` (requiere ≥ 2 puntos).
  - Test(s): mismo spec.
- [x] Bloque 3: e2e — el evento `trayectoria` se ingiere en el catálogo.
  - Test(s): `test/e2e/sincronizacion-offline.e2e-spec.ts` (+1).

## Decisiones tomadas durante la implementación
- El permiso del evento es `generar_reporte` (el cobrador que registra la trayectoria online usa ese permiso en `/cobrador/rutas/:id/trayectoria-real`).
- El DTO reutilizado exige ≥ 2 puntos (LineString GeoJSON), consistente con el flujo online.
- En el e2e de sync, el cobrador no tiene matriz configurada → el on-ingest marca el evento como `error` por permiso, pero la ingesta/ack y el catálogo se validan.

## Ambigüedades resueltas con el usuario
- (ninguna abierta)

## Resultado final
- Comandos ejecutados para verificar: `scripts/check.sh` verde (814 tests, 95 suites) + e2e sync-offline (9 tests).
- Archivos modificados: `src/modules/sincronizacion-offline/sincronizacion-offline.service.ts` (catálogo), `src/modules/sincronizacion-offline/aplicar-eventos-offline.service.ts` (DTO + permiso + case), `src/modules/sincronizacion-offline/aplicar-eventos-offline.service.spec.ts` (+3), `test/e2e/sincronizacion-offline.e2e-spec.ts` (+1).
- Pendientes/seguimiento: encolado de trayectoria en la APK (`apk-trayectoria-offline`).