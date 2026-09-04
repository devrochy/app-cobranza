# Tarea: Backend — endpoints cobrador para rediseño APK (A1-A5)

- **Origen:** Rediseño APK aprobado 2026-09-03 (detalle de cliente + sesión dual + rutas).
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-03

## Objetivo
Exponer al rol cobrador (y socio vía JWT) los endpoints que la APK necesita para: detalle de cuota (modal cobro/abono/motivo), crear/actualizar cliente (con ubicación negocio/domicilio), mis rutas para rol socio, y notas de ruta.

## Fuera de alcance
- Edición de ruta desde APK (queda solo lectura; pendiente en backlog).
- KPIs de ruta completos (inyectado/gastos/caja) para cobrador (sin endpoint; se usa "solo datos existentes").

## Bloques (checklist TDD)
- [x] Bloque 1 (A1): `GET /cobrador/rutas/:rutaId/prestamos/:prestamoId/cuotas/:cuotaId/detalle` devuelve pagos, abonos imputados y última visita.
  - `src/modules/cartera/detalle-cuota.service.spec.ts`, `cobrador.controller.spec.ts`, `cobrador.service.spec.ts`
- [x] Bloque 2 (A2): `POST /cobrador/rutas/:rutaId/clientes` (multipart foto+doc) crea cliente.
  - `cobrador.controller.spec.ts`, `cobrador.service.spec.ts`
- [x] Bloque 3 (A3): `PATCH /cobrador/rutas/:rutaId/clientes/:clienteId` actualiza datos + ubicación.
  - `cobrador.controller.spec.ts`, `cobrador.service.spec.ts`
- [x] Bloque 4 (A4): `GET /cobrador/mis-rutas` devuelve rutas del socio cuando el token es rol `socio` (guard dual + mapeo permisos).
  - `cobrador-permiso.guard.spec.ts`, `cobrador.service.spec.ts`
- [x] Bloque 5 (A5): `GET/POST /cobrador/rutas/:rutaId/notas` (permiso anotar_notas_ruta).
  - `cobrador.controller.spec.ts`, `cobrador.service.spec.ts`

## Resultado final (llenar al completar)
- Comandos: `scripts/check.sh` backend verde (lint + typecheck + tests).
- Archivos: `src/modules/cartera/detalle-cuota.service.ts` (+spec), `cobrador.service.ts` (+spec), `cobrador.controller.ts` (+spec), `cobrador-permiso.guard.ts` (+spec), `cartera.module.ts`.
- Pendientes: edición de ruta para socio en APK (backlog).
## 2026-09-04 — logging HTTP, fix posición socio y avatares uniformes
- **RequestLoggingInterceptor** global: loguea `method ruta status duración` y el cuerpo de errores >=400 (NestJS no loguea excepciones HTTP manejadas). `src/common/request-logging.interceptor.ts` (+spec). Habilitado vía `APP_INTERCEPTOR` en `app.module.ts`.
- **Fix `posicion_cobrador`**: `cobradorId` ahora sale de `ruta.cobrador` (no de `requester.sub`). La APK envía posición también cuando entra como socio; `requester.sub` (id de socio) violaba la FK a `cobradores(id)` → 500 cada 30s. Verificado: POST posición como socio → 201.
- **Seed sin fotos**: se eliminó la silueta PNG (`AVATAR_PLACEHOLDER`, `evidenciaCliente`, param `conFotos`); todos los clientes de prueba se siembran sin evidencias → avatar icono uniforme en todas las rutas. Limpieza live: 30 evidencias + 32 archivos `test-*` borrados; se conservan los 5 clientes con foto real creados en pruebas.
- **Límite Multer fotos 15MB** (5MB→15MB) + spec: `cliente-foto-upload.spec.ts`.
