---
estado: completada
tags: [tarea]
---

# Tarea: epica8-dispositivos (backend)

- **Origen:** Petición directa del usuario (2026-09-10) + Épica 8
  (`docs/APP_REQUIREMENTS.md:115-121`, HU-39..HU-43) y HU-64.
- **Estado:** completada
- **Fecha inicio:** 2026-09-10

## Objetivo
Vincular **device ↔ cobrador** (1:1), validar el dispositivo en el login,
aplicar los eventos offline por cobrador (todas sus rutas), cifrar la
ruta/itinerario del día (HU-40), auditar aperturas (HU-41), registrar/alertar
accesos no autorizados (HU-42) y permitir re-vinculación (HU-43).

## Decisiones con el usuario
- Un device por cobrador (1:1 estricto; al vincular uno nuevo se revoca el anterior).
- IMEI = Android ID (`expo-application`); WhatsApp = `cobrador.telefono` (simulado).
- Se mantiene la `x-device-key` (`codigo.secreto`) además de IMEI/WhatsApp.
- HU-40 con cifrado real (X25519 + HKDF + AES-256-GCM).
- Alertas HU-42 en el panel ahora; envío WhatsApp detrás de una interfaz (mock).
- Cifrado en reposo de tablas: **fuera de alcance** (tarea aparte).

## Bloques (checklist TDD)
- [x] B1 (HU-39): vinculación device↔cobrador (entidad + DTOs + service + endpoints admin). → PR #107
- [x] B2 (HU-39/42): login valida IMEI+WhatsApp; 403. (El registro del intento va en B6.) → PR #108
- [x] B3 (HU-64/HU-39): apply offline por cobrador (todas sus rutas). → PR #107
- [x] B4 (HU-40): snapshot del día cifrado (X25519+HKDF+AES-256-GCM). → PR #109
- [x] B5 (HU-41): apertura (timestamp + coordenadas). → ya existía (`RutasAperturaService`, `POST /cobrador/rutas/:rutaId/apertura`).
- [x] B6 (HU-42): tabla de intentos no autorizados + consulta (`GET /intentos-acceso`) + alerta (mock `AlertasService`). → PR #110
- [x] B7 (HU-43): re-vinculación. → cubierta por B1 (`POST /devices` revoca el anterior 1:1).

## Resultado final
- B1–B7 implementados y mergeados en `develop` (PRs #107, #108, #109, #110; script #111).
- `bash scripts/check.sh` verde (918 tests); e2e `sincronizacion-offline` + `auth` verdes.
- Verificado end-to-end con `scripts/probar-epica8.sh` (device, intento, snapshot cifrado + descifrado, apertura, revocación).

## Pendiente post-MVP — Vinculación autoservicio desde la APK (Opción 2b)
La vinculación del dispositivo **iniciada por la APK** (autoservicio, con aprobación del admin) queda fuera del MVP: hoy la APK no envía `imei`/`whatsappNumber` en el login, así que con un device vinculado el login da 403 (comportamiento esperado hasta retomar esta opción). Del lado backend implica:
- `POST /cobrador/dispositivo` (JWT de cobrador) para que el cobrador vincule su propio device.
- Dejar el device en `pendiente_revalidacion` + endpoint de aprobación admin (`PATCH /devices/:id/aprobar`).
- Exponer el `telefono` del cobrador en el login/perfil.
- Alerta al admin al recibir una solicitud (reusar `AlertasService`).

Plan detallado y decisiones abiertas: `app-cobranza-apk/docs/ai/tasks/apk-autovinculacion-dispositivo.md`.
