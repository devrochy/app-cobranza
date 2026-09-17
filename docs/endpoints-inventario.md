# Inventario de endpoints del backend (panel admin + APK)

- **Estado:** vigente 2026-09-17 (nomenclatura migrada: Cartera/Gestor/Propietario/trayecto diario — ver `docs/glosario.md`).
- **Alcance:** matriz de todos los endpoints HTTP expuestos por el backend NestJS y su consumidor real (panel admin, APK gestor, o ninguno).
- **Decisión de esta iteración:** **documentar y conservar** los endpoints sin consumidor. No se elimina ni modifica ningún endpoint.

## Leyenda

| Columna | Valores |
|---|---|
| Consumidor | `panel` (app-cobranza-admin), `apk` (app-cobranza-apk), `panel+apk`, `infra`, `ninguno` |
| Estado | `en uso` — tiene consumidor real; `sin consumidor` — existe pero nadie lo llama (conservado); `infra` — operación/salud |

---

## Auth (`/auth`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /auth/login` | auth | panel | en uso | Login admin (server action). |
| `POST /auth/propietario/login` | auth | panel | en uso | Login propietario (server action). |
| `POST /auth/gestor/login` | auth | apk | en uso | `apiLogin` en `src/api/auth.ts`. |
| `POST /auth/refresh` | auth | panel | en uso | Refresh de tokens en `src/lib/api.ts`. |
| `GET /auth/me` | auth | ninguno | sin consumidor | Conservado: el panel deriva el usuario de la cookie JWT (`session.sub`); puede ser útil para validación futura. |

---

## Panel (dashboard, monitoreo IA, clientes global, reportes, tiempo real)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /dashboard` | panel (dashboard) | panel | en uso | Dashboard consolidado (HU-23). |
| `GET /conversaciones-ia/panel` | panel (IA) | panel | en uso | Monitoreo IA (HU-24). |
| `GET /clientes` | cartera | panel | en uso | Cartera global con filtros. |
| `GET /reportes/liquidaciones` | reportes | panel | en uso | Historial de liquidaciones global. |
| `GET /carteras/posiciones` | carteras | panel | en uso | Posiciones en vivo de gestores (HU-44), vía route handler `/api/tiempo-real`. |

---

## Propietarios (`/propietarios`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /propietarios` | propietarios | panel | en uso | |
| `GET /propietarios` | propietarios | panel | en uso | Listado + filtros. |
| `GET /propietarios/:id` | propietarios | panel | en uso | Detalle. |
| `PATCH /propietarios/:id` | propietarios | panel | en uso | Editar. |
| `PATCH /propietarios/:id/estatus` | propietarios | panel | en uso | Activar/bloquear. |
| `PATCH /propietarios/:id/configuracion` | propietarios | panel | en uso | Configuración. |
| `GET /propietarios/:id/permisos` | propietarios | panel | en uso | |
| `PUT /propietarios/:id/permisos` | propietarios | panel | en uso | |

## Cobros de propietario (`/cobros-propietario`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /cobros-propietario` | cobros-propietario | panel | en uso | Listado por propietario. |
| `GET /cobros-propietario/:id` | cobros-propietario | ninguno | sin consumidor | Conservado: detalle de un cobro; hoy el panel solo lista, genera y paga. |
| `POST /cobros-propietario/generar` | cobros-propietario | panel | en uso | |
| `POST /cobros-propietario/:id/pago` | cobros-propietario | panel | en uso | |

## Conversaciones Admin↔Propietario (`/conversaciones-propietario`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /conversaciones-propietario` | conversaciones-propietario | panel | en uso | |
| `GET /conversaciones-propietario/:propietarioId` | conversaciones-propietario | panel | en uso | |
| `POST /conversaciones-propietario/:propietarioId/mensajes` | conversaciones-propietario | panel | en uso | |

---

## Gestores (`/gestores`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /gestores` | gestores | panel | en uso | |
| `GET /gestores` | gestores | panel | en uso | |
| `PATCH /gestores/:id` | gestores | panel | en uso | |
| `PATCH /gestores/:id/estatus` | gestores | panel | en uso | |
| `GET /gestores/:id/permisos` | gestores | panel | en uso | |
| `PUT /gestores/:id/permisos` | gestores | panel | en uso | |

---

## Carteras (`/carteras`, `/carteras/:id`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /carteras` | carteras | panel | en uso | |
| `GET /carteras` | carteras | panel | en uso | |
| `GET /carteras/:id` | carteras | panel | en uso | |
| `PATCH /carteras/:id` | carteras | panel | en uso | |
| `PATCH /carteras/:id/estatus` | carteras | panel | en uso | |
| `PATCH /carteras/:id/configuracion` | carteras | panel | en uso | |
| `PATCH /carteras/:id/gestor` | carteras | panel | en uso | Reasignar gestor. |
| `PUT /carteras/:id/cartera-config` | carteras | panel | en uso | |
| `GET /carteras/:id/resumen` | carteras | panel | en uso | |
| `GET /carteras/:id/cartera-config` | carteras | panel | en uso | |
| `GET /carteras/:id/caja` | carteras | panel | en uso | |
| `GET /carteras/:id/gastos` | carteras | panel | en uso | |
| `POST /carteras/:id/gastos` | carteras | panel | en uso | (multipart, evidencias) |
| `DELETE /carteras/:id/gastos/:gastoId` | carteras | panel | en uso | |
| `PATCH /carteras/:id/gastos/:gastoId/aprobar` | carteras | panel | en uso | |
| `GET /carteras/:id/inyecciones` | carteras | panel | en uso | |
| `POST /carteras/:id/inyecciones` | carteras | panel | en uso | |
| `DELETE /carteras/:id/inyecciones/:inyeccionId` | carteras | panel | en uso | |
| `GET /carteras/:id/notas` | carteras | panel | en uso | |
| `POST /carteras/:id/notas` | carteras | panel | en uso | |
| `PATCH /carteras/:id/notas/:notaId` | carteras | panel | en uso | |
| `DELETE /carteras/:id/notas/:notaId` | carteras | panel | en uso | |
| `GET /carteras/:id/liquidaciones` | carteras | panel | en uso | |
| `POST /carteras/:id/liquidaciones` | carteras | panel | en uso | |
| `GET /carteras/:id/liquidaciones/:liquidacionId/export` | carteras | panel | en uso | Vía route handler Next.js. |

### Trayecto diario / trayectos / trayectorias

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /carteras/:id/trayecto-diario/trayectos` | carteras | panel | en uso | Generar trayectos (HU-55). |
| `GET /carteras/:id/trayecto-diario/trayectos` | carteras | panel | en uso | Consultar trayectos planificados. |
| `GET /carteras/:id/trayecto-diario/clientes` | carteras | panel | en uso | Lista de clientes del día (HU-13/56). |
| `GET /carteras/:id/trayecto-diario/mapa` | carteras | panel | en uso | Mapa de clientes del día (HU-57). |
| `POST /carteras/:id/trayecto-diario/trayectoria-real` | carteras | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/gestor/carteras/:carteraId/trayectoria-real`. Duplicado funcional. |
| `GET /carteras/:id/trayecto-diario/trayectorias` | carteras | ninguno | sin consumidor | Conservado: reporte diario planificada+real en GeoJSON (HU-49/50). El panel usa `/dia/trayectos` + `/dia/mapa`. |

---

## Clientes (`/carteras/:carteraId/clientes` y `/clientes`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /carteras/:carteraId/clientes` | cartera | panel+apk | en uso | Panel: cartera por cartera; APK: `listarClientesDeCartera`. |
| `POST /carteras/:carteraId/clientes` | cartera | panel | en uso | |
| `PATCH /carteras/:carteraId/clientes/:clienteId` | cartera | panel | en uso | Editar cliente. |
| `PATCH /carteras/:carteraId/clientes/:clienteId/estatus` | cartera | ninguno | sin consumidor | Conservado: el panel edita/borra cliente por otro flujo; la APK no usa estatus. |
| `GET /carteras/:carteraId/clientes/:clienteId/tarjeta` | cartera | panel+apk | en uso | Tarjeta de cliente (HU-54). |
| `GET /carteras/:carteraId/clientes/:clienteId/prestamos` | cartera | panel+apk | en uso | |
| `GET /carteras/:carteraId/clientes/:clienteId/conversacion` | cartera | panel | en uso | Historial conversación con cliente (HU-53). |
| `POST /carteras/:carteraId/clientes/:clienteId/conversacion/mensajes` | cartera | panel | en uso | |
| `GET /carteras/:carteraId/clientes/:clienteId/navegacion` | cartera | ninguno | sin consumidor | Conservado: enlace maps/waze (HU-59). La APK genera el enlace localmente (HU-37/59) y el panel no abre navegación desde cliente. |
| `GET /carteras/:carteraId/prestamos` | cartera | panel | en uso | |
| `POST /carteras/:carteraId/prestamos` | cartera | panel | en uso | |
| `GET /carteras/:carteraId/prestamos/:prestamoId/estado-cuenta` | cartera | panel+apk | en uso | Estado de cuenta por préstamo (HU-54). |
| `GET /carteras/:carteraId/prestamos/:prestamoId/promesas` | cartera | panel | en uso | |
| `PATCH /carteras/:carteraId/promesas/:promesaId/estado` | cartera | panel | en uso | |
| `PATCH /carteras/:carteraId/cuotas/:cuotaId` | cartera | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/gestor/carteras/:carteraId/cuotas/:cuotaId`. Duplicado funcional. |
| `DELETE /carteras/:carteraId/cuotas/:cuotaId` | cartera | ninguno | sin consumidor | Conservado: idem. |
| `POST /carteras/:carteraId/pagos` | cartera | panel | en uso | |
| `POST /carteras/:carteraId/abonos` | cartera | panel | en uso | |
| `POST /carteras/:carteraId/visitas` | cartera | panel | en uso | |
| `GET /carteras/:carteraId/cambios-cliente` | cartera | panel | en uso | Cambios pendientes con aprobación (HU-47). |
| `PATCH /carteras/:carteraId/cambios-cliente/:cambioId/decision` | cartera | panel | en uso | Aprobar/rechazar cambio. |
| `DELETE /carteras/:carteraId/abonos/:abonoId` | cartera | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/gestor/...`. Duplicado funcional. |

---

## APK gestor (`/gestor`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /gestor/mis-carteras` | gestor | apk | en uso | Carteras + tipoInteres/numCuotas + permisos. |
| `GET /gestor/carteras/:carteraId/dia` | gestor | apk | en uso | Snapshot del día (clientes + trayectos). |
| `POST /gestor/carteras/:carteraId/trayecto` | gestor | apk | en uso | Generar trayecto (HU-55). |
| `POST /gestor/carteras/:carteraId/apertura` | gestor | apk | en uso | Auditoría de apertura (HU-41). |
| `POST /gestor/carteras/:carteraId/posicion` | gestor | apk | en uso | Posición GPS (HU-44). |
| `POST /gestor/carteras/:carteraId/visitas/pago` | gestor | apk | en uso | |
| `POST /gestor/carteras/:carteraId/visitas/no-pago` | gestor | apk | en uso | |
| `POST /gestor/carteras/:carteraId/gastos` | gestor | apk | en uso | (multipart, evidencias) |
| `POST /gestor/carteras/:carteraId/trayectoria-real` | gestor | apk | en uso | Registro de trayectoria real (HU-38/49). |
| `POST /gestor/carteras/:carteraId/prestamos` | gestor | apk | en uso | |
| `PATCH /gestor/carteras/:carteraId/cuotas/:cuotaId` | gestor | apk | en uso | |
| `DELETE /gestor/carteras/:carteraId/cuotas/:cuotaId` | gestor | apk | en uso | |
| `DELETE /gestor/carteras/:carteraId/abonos/:abonoId` | gestor | apk | en uso | |
| `GET /gestor/carteras/:carteraId/clientes` | gestor | apk | en uso | |
| `GET /gestor/carteras/:carteraId/clientes/:clienteId/tarjeta` | gestor | apk | en uso | |
| `GET /gestor/carteras/:carteraId/clientes/:clienteId/prestamos` | gestor | apk | en uso | |
| `POST /gestor/carteras/:carteraId/clientes/:clienteId/evidencias` | gestor | apk | en uso | Foto/documento (multipart). |
| `GET /gestor/carteras/:carteraId/prestamos/:prestamoId/estado-cuenta` | gestor | apk | en uso | |

---

## Offline-first / dispositivos

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /sync-offline/eventos` | sincronizacion-offline | apk | en uso | Envío de cola offline (device key header). |
| `GET /sync-offline/trayecto-diario` | sincronizacion-offline | ninguno | sin consumidor | Conservado: snapshot offline del día; la APK usa `GET /gestor/carteras/:carteraId/dia` en su lugar. |
| `POST /devices` | sincronizacion-offline | ninguno | sin consumidor | Conservado: la APK envía `EXPO_PUBLIC_DEVICE_KEY` fija en header y nunca registra el device. |

---

## Reglas de negociación IA y simulador WhatsApp

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /reglas-negociacion-ia` | reglas-ia | ninguno | sin consumidor | Conservado: feature IA (fase 2). |
| `PUT /reglas-negociacion-ia` | reglas-ia | ninguno | sin consumidor | Conservado: idem. |
| `POST /whatsapp/simulado/recibir` | whatsapp | ninguno | sin consumidor | Conservado: sandbox de pruebas WhatsApp (fase 2 / piloto). |

---

## Infraestructura

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /health` | health | infra | en uso | Healthcheck de deploy/CI. |

---

## Duplicados funcionales (nota)

- **Trayectoria real**: `POST /carteras/:id/trayecto-diario/trayectoria-real` (panel) vs `POST /gestor/carteras/:carteraId/trayectoria-real` (APK). Solo el del gestor tiene consumidor.
- **Cuotas**: `PATCH/DELETE /carteras/:carteraId/cuotas/:cuotaId` (panel) vs `PATCH/DELETE /gestor/carteras/:carteraId/cuotas/:cuotaId` (APK). Solo el del gestor tiene consumidor.
- **Abonos**: `DELETE /carteras/:carteraId/abonos/:abonoId` (panel) vs `DELETE /gestor/carteras/:carteraId/abonos/:abonoId` (APK). Solo el del gestor tiene consumidor.

**Decisión:** se conservan ambos para no romper contratos; se documenta que el consumidor real es el de `/gestor/*`.

---

## Cobertura

- Todos los endpoints que consumen el **panel admin** y la **APK** están servidos por el backend. No hay huecos de cobertura.
- Endpoints sin consumidor: **~15** (detallados arriba), todos **conservados** por decisión de esta iteración.

## Comando de verificación

El inventario es documentación; no afecta `scripts/check.sh`. Para re-generar la lista de endpoints:

```bash
cd src && grep -rn "@Controller(" modules --include="*.controller.ts" | sed 's/.*@Controller(//;s/).*//' | sort
```