# Tarea: cliente-documento-identidad

- **Origen:** Petición directa del usuario (2026-09-10). Validada contra
  `docs/APP_REQUIREMENTS.md` (HU-14) y el estado actual del backend.
- **Estado:** en progreso
- **Fecha inicio:** 2026-09-10

## Objetivo
El cliente guarda un **documento de identidad**: `tipoDocumento`
(`ci`/`pasaporte`/`nit`/`otro`) + `numeroDocumento`, **obligatorio** al crear y
al editar, **validado por tipo**, y expuesto en las respuestas (panel y APK).
Se mantienen las fotos `documento_frente`/`documento_reverso`.

## Fuera de alcance
- Varios documentos por cliente (es uno).
- Cambiar la obligatoriedad de las fotos (siguen según flags de ruta).
- Migración de producción (dev usa `synchronize: true`).

## Bloques (checklist TDD)
- [x] Bloque 1: catálogo de tipos + validador por tipo + normalización.
  - Test(s): `src/domain/tipo-documento.spec.ts` (7 tests).
- [x] Bloque 2: entidad `Cliente` + `CreateClienteDto`/`ActualizarClienteDto` +
  `ClienteService` (`crear`, `listar`→`toPublic`, `actualizar`, `aplicarCambios`,
  `camposPropuestos`, `aplicarCamposPropuestos`).
  - Test(s): `cliente.service.spec.ts` (+4 tests de documento).
- [x] Bloque 3: exponer en `ClienteTarjetaPublic` (`cliente-tarjeta.service.ts`).
  - Test(s): `cliente-tarjeta.service.spec.ts`.
- [x] Bloque 4: documentar en `docs/APP_REQUIREMENTS.md` (HU-14 + modelo
  `clientes`) + `scripts/check.sh` verde.

## Decisiones tomadas durante la implementación
- Validación por tipo (regex propuestas):
  `ci` `^[0-9]{6,9}([- ][A-Z0-9]{1,3})?$`, `pasaporte` `^[A-Z0-9]{6,12}$`,
  `nit` `^[0-9]{7,15}$`, `otro` `^[A-Za-z0-9-]{3,30}$`.
- Obligatorio: en `create` (DTO) y en `update` cuando el cliente aún no tiene
  documento; los formularios (APK/panel) siempre lo exigen.

## Ambigüedades resueltas con el usuario
- ¿Un documento o varios? → Uno (tipo + número).
- ¿Validación? → Por tipo.
- ¿Obligatorio? → Siempre para registrar y editar.
- ¿Panel incluido? → Sí (PR aparte en `app-cobranza-admin`).
- ¿Se mantienen las fotos? → Sí.

## Resultado final (llenar al completar)
- Comandos: `scripts/check.sh` → 102 suites / 898 tests, lint + typecheck OK.
- Archivos: `src/domain/tipo-documento.ts` (+spec), `cliente.entity.ts`,
  `dto/create-cliente.dto.ts`, `dto/actualizar-cliente.dto.ts`,
  `cliente.service.ts` (+spec), `cliente-tarjeta.service.ts` (+spec),
  specs de `cartera`/`cobrador`, `test-data.seed.service.ts`, e2e (payloads de
  cliente con documento), `docs/APP_REQUIREMENTS.md`.
- Pendientes/seguimiento: migración de producción (dev auto-sync con
  `synchronize: true`); APK y panel en repos aparte (PRs siguientes).
