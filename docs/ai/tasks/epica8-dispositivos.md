# Tarea: epica8-dispositivos (backend)

- **Origen:** Petición directa del usuario (2026-09-10) + Épica 8
  (`docs/APP_REQUIREMENTS.md:115-121`, HU-39..HU-43) y HU-64.
- **Estado:** en progreso
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
- [ ] B1 (HU-39): vinculación device↔cobrador (entidad + DTOs + service + endpoints admin).
- [ ] B2 (HU-39/42): login valida IMEI+WhatsApp; 403 + registro de intento.
- [ ] B3 (HU-64/HU-39): apply offline por cobrador (todas sus rutas).
- [ ] B4 (HU-40): snapshot del día cifrado (X25519+HKDF+AES-256-GCM).
- [ ] B5 (HU-41): apertura con device/imei.
- [ ] B6 (HU-42): tabla de intentos no autorizados + consulta.
- [ ] B7 (HU-43): re-vinculación.

## Resultado final (llenar al completar)
- (pendiente)
