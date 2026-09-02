# Inventario de endpoints del backend (panel admin + APK)

- **Estado:** vigente 2026-09-02
- **Alcance:** matriz de todos los endpoints HTTP expuestos por el backend NestJS y su consumidor real (panel admin, APK cobrador, o ninguno).
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
| `POST /auth/socio/login` | auth | panel | en uso | Login socio (server action). |
| `POST /auth/cobrador/login` | auth | apk | en uso | `apiLogin` en `src/api/auth.ts`. |
| `POST /auth/refresh` | auth | panel | en uso | Refresh de tokens en `src/lib/api.ts`. |
| `GET /auth/me` | auth | ninguno | sin consumidor | Conservado: el panel deriva el usuario de la cookie JWT (`session.sub`); puede ser útil para validación futura. |

---

## Panel (dashboard, monitoreo IA, cartera global, reportes, tiempo real)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /dashboard` | panel (dashboard) | panel | en uso | Dashboard consolidado (HU-23). |
| `GET /conversaciones-ia/panel` | panel (IA) | panel | en uso | Monitoreo IA (HU-24). |
| `GET /cartera/clientes` | cartera | panel | en uso | Cartera global con filtros. |
| `GET /reportes/liquidaciones` | reportes | panel | en uso | Historial de liquidaciones global. |
| `GET /rutas/posiciones` | rutas | panel | en uso | Posiciones en vivo de cobradores (HU-44), vía route handler `/api/tiempo-real`. |

---

## Socios (`/socios`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /socios` | socios | panel | en uso | |
| `GET /socios` | socios | panel | en uso | Listado + filtros. |
| `GET /socios/:id` | socios | panel | en uso | Detalle. |
| `PATCH /socios/:id` | socios | panel | en uso | Editar. |
| `PATCH /socios/:id/estatus` | socios | panel | en uso | Activar/bloquear. |
| `PATCH /socios/:id/configuracion` | socios | panel | en uso | Configuración. |
| `GET /socios/:id/permisos` | socios | panel | en uso | |
| `PUT /socios/:id/permisos` | socios | panel | en uso | |

## Cobros de socio (`/cobros-socio`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /cobros-socio` | cobros-socio | panel | en uso | Listado por socio. |
| `GET /cobros-socio/:id` | cobros-socio | ninguno | sin consumidor | Conservado: detalle de un cobro; hoy el panel solo lista, genera y paga. |
| `POST /cobros-socio/generar` | cobros-socio | panel | en uso | |
| `POST /cobros-socio/:id/pago` | cobros-socio | panel | en uso | |

## Conversaciones Admin↔Socio (`/conversaciones-socio`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /conversaciones-socio` | conversaciones-socio | panel | en uso | |
| `GET /conversaciones-socio/:socioId` | conversaciones-socio | panel | en uso | |
| `POST /conversaciones-socio/:socioId/mensajes` | conversaciones-socio | panel | en uso | |

---

## Cobradores (`/cobradores`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /cobradores` | cobradores | panel | en uso | |
| `GET /cobradores` | cobradores | panel | en uso | |
| `PATCH /cobradores/:id` | cobradores | panel | en uso | |
| `PATCH /cobradores/:id/estatus` | cobradores | panel | en uso | |
| `GET /cobradores/:id/permisos` | cobradores | panel | en uso | |
| `PUT /cobradores/:id/permisos` | cobradores | panel | en uso | |

---

## Rutas (`/rutas`, `/rutas/:id`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /rutas` | rutas | panel | en uso | |
| `GET /rutas` | rutas | panel | en uso | |
| `GET /rutas/:id` | rutas | panel | en uso | |
| `PATCH /rutas/:id` | rutas | panel | en uso | |
| `PATCH /rutas/:id/estatus` | rutas | panel | en uso | |
| `PATCH /rutas/:id/configuracion` | rutas | panel | en uso | |
| `PATCH /rutas/:id/cobrador` | rutas | panel | en uso | Reasignar cobrador. |
| `PUT /rutas/:id/ruta-config` | rutas | panel | en uso | |
| `GET /rutas/:id/resumen` | rutas | panel | en uso | |
| `GET /rutas/:id/ruta-config` | rutas | panel | en uso | |
| `GET /rutas/:id/caja` | rutas | panel | en uso | |
| `GET /rutas/:id/gastos` | rutas | panel | en uso | |
| `POST /rutas/:id/gastos` | rutas | panel | en uso | (multipart, evidencias) |
| `DELETE /rutas/:id/gastos/:gastoId` | rutas | panel | en uso | |
| `PATCH /rutas/:id/gastos/:gastoId/aprobar` | rutas | panel | en uso | |
| `GET /rutas/:id/inyecciones` | rutas | panel | en uso | |
| `POST /rutas/:id/inyecciones` | rutas | panel | en uso | |
| `DELETE /rutas/:id/inyecciones/:inyeccionId` | rutas | panel | en uso | |
| `GET /rutas/:id/notas` | rutas | panel | en uso | |
| `POST /rutas/:id/notas` | rutas | panel | en uso | |
| `PATCH /rutas/:id/notas/:notaId` | rutas | panel | en uso | |
| `DELETE /rutas/:id/notas/:notaId` | rutas | panel | en uso | |
| `GET /rutas/:id/liquidaciones` | rutas | panel | en uso | |
| `POST /rutas/:id/liquidaciones` | rutas | panel | en uso | |
| `GET /rutas/:id/liquidaciones/:liquidacionId/export` | rutas | panel | en uso | Vía route handler Next.js. |

### Día / trayectos / trayectorias de ruta

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /rutas/:id/dia/trayectos` | rutas | panel | en uso | Generar trayectos (HU-55). |
| `GET /rutas/:id/dia/trayectos` | rutas | panel | en uso | Consultar trayectos planificados. |
| `GET /rutas/:id/dia/clientes` | rutas | panel | en uso | Lista de clientes del día (HU-13/56). |
| `GET /rutas/:id/dia/mapa` | rutas | panel | en uso | Mapa de clientes del día (HU-57). |
| `POST /rutas/:id/dia/trayectoria-real` | rutas | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/cobrador/rutas/:rutaId/trayectoria-real`. Duplicado funcional. |
| `GET /rutas/:id/dia/trayectorias` | rutas | ninguno | sin consumidor | Conservado: reporte diario planificada+real en GeoJSON (HU-49/50). El panel usa `/dia/trayectos` + `/dia/mapa`. |

---

## Cartera (`/rutas/:rutaId/clientes` y `/cartera`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /rutas/:rutaId/clientes` | cartera | panel+apk | en uso | Panel: cartera por ruta; APK: `listarClientesDeRuta`. |
| `POST /rutas/:rutaId/clientes` | cartera | panel | en uso | |
| `PATCH /rutas/:rutaId/clientes/:clienteId` | cartera | panel | en uso | Editar cliente. |
| `PATCH /rutas/:rutaId/clientes/:clienteId/estatus` | cartera | ninguno | sin consumidor | Conservado: el panel edita/borra cliente por otro flujo; la APK no usa estatus. |
| `GET /rutas/:rutaId/clientes/:clienteId/tarjeta` | cartera | panel+apk | en uso | Tarjeta de cliente (HU-54). |
| `GET /rutas/:rutaId/clientes/:clienteId/prestamos` | cartera | panel+apk | en uso | |
| `GET /rutas/:rutaId/clientes/:clienteId/conversacion` | cartera | panel | en uso | Historial conversación con cliente (HU-53). |
| `POST /rutas/:rutaId/clientes/:clienteId/conversacion/mensajes` | cartera | panel | en uso | |
| `GET /rutas/:rutaId/clientes/:clienteId/navegacion` | cartera | ninguno | sin consumidor | Conservado: enlace maps/waze (HU-59). La APK genera el enlace localmente (HU-37/59) y el panel no abre navegación desde cliente. |
| `GET /rutas/:rutaId/prestamos` | cartera | panel | en uso | |
| `POST /rutas/:rutaId/prestamos` | cartera | panel | en uso | |
| `GET /rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` | cartera | panel+apk | en uso | Estado de cuenta por préstamo (HU-54). |
| `GET /rutas/:rutaId/prestamos/:prestamoId/promesas` | cartera | panel | en uso | |
| `PATCH /rutas/:rutaId/promesas/:promesaId/estado` | cartera | panel | en uso | |
| `PATCH /rutas/:rutaId/cuotas/:cuotaId` | cartera | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/cobrador/rutas/:rutaId/cuotas/:cuotaId`. Duplicado funcional. |
| `DELETE /rutas/:rutaId/cuotas/:cuotaId` | cartera | ninguno | sin consumidor | Conservado: idem. |
| `POST /rutas/:rutaId/pagos` | cartera | panel | en uso | |
| `POST /rutas/:rutaId/abonos` | cartera | panel | en uso | |
| `POST /rutas/:rutaId/visitas` | cartera | panel | en uso | |
| `GET /rutas/:rutaId/cambios-cliente` | cartera | panel | en uso | Cambios pendientes con aprobación (HU-47). |
| `PATCH /rutas/:rutaId/cambios-cliente/:cambioId/decision` | cartera | panel | en uso | Aprobar/rechazar cambio. |
| `DELETE /rutas/:rutaId/abonos/:abonoId` | cartera | ninguno | sin consumidor | Conservado: la APK usa el equivalente `/cobrador/...`. Duplicado funcional. |

---

## APK cobrador (`/cobrador`)

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `GET /cobrador/mis-rutas` | cobrador | apk | en uso | Rutas + tipoInteres/numCuotas + permisos. |
| `GET /cobrador/rutas/:rutaId/dia` | cobrador | apk | en uso | Snapshot del día (clientes + trayectos). |
| `POST /cobrador/rutas/:rutaId/trayecto` | cobrador | apk | en uso | Generar trayecto (HU-55). |
| `POST /cobrador/rutas/:rutaId/apertura` | cobrador | apk | en uso | Auditoría de apertura (HU-41). |
| `POST /cobrador/rutas/:rutaId/posicion` | cobrador | apk | en uso | Posición GPS (HU-44). |
| `POST /cobrador/rutas/:rutaId/visitas/pago` | cobrador | apk | en uso | |
| `POST /cobrador/rutas/:rutaId/visitas/no-pago` | cobrador | apk | en uso | |
| `POST /cobrador/rutas/:rutaId/gastos` | cobrador | apk | en uso | (multipart, evidencias) |
| `POST /cobrador/rutas/:rutaId/trayectoria-real` | cobrador | apk | en uso | Registro de trayectoria real (HU-38/49). |
| `POST /cobrador/rutas/:rutaId/prestamos` | cobrador | apk | en uso | |
| `PATCH /cobrador/rutas/:rutaId/cuotas/:cuotaId` | cobrador | apk | en uso | |
| `DELETE /cobrador/rutas/:rutaId/cuotas/:cuotaId` | cobrador | apk | en uso | |
| `DELETE /cobrador/rutas/:rutaId/abonos/:abonoId` | cobrador | apk | en uso | |
| `GET /cobrador/rutas/:rutaId/clientes` | cobrador | apk | en uso | |
| `GET /cobrador/rutas/:rutaId/clientes/:clienteId/tarjeta` | cobrador | apk | en uso | |
| `GET /cobrador/rutas/:rutaId/clientes/:clienteId/prestamos` | cobrador | apk | en uso | |
| `POST /cobrador/rutas/:rutaId/clientes/:clienteId/evidencias` | cobrador | apk | en uso | Foto/documento (multipart). |
| `GET /cobrador/rutas/:rutaId/prestamos/:prestamoId/estado-cuenta` | cobrador | apk | en uso | |

---

## Offline-first / dispositivos

| Endpoint | Controller | Consumidor | Estado | Nota |
|---|---|---|---|---|
| `POST /sync-offline/eventos` | sincronizacion-offline | apk | en uso | Envío de cola offline (device key header). |
| `GET /sync-offline/dia` | sincronizacion-offline | ninguno | sin consumidor | Conservado: snapshot offline del día; la APK usa `GET /cobrador/rutas/:rutaId/dia` en su lugar. |
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

- **Trayectoria real**: `POST /rutas/:id/dia/trayectoria-real` (panel) vs `POST /cobrador/rutas/:rutaId/trayectoria-real` (APK). Solo el del cobrador tiene consumidor.
- **Cuotas**: `PATCH/DELETE /rutas/:rutaId/cuotas/:cuotaId` (panel) vs `PATCH/DELETE /cobrador/rutas/:rutaId/cuotas/:cuotaId` (APK). Solo el del cobrador tiene consumidor.
- **Abonos**: `DELETE /rutas/:rutaId/abonos/:abonoId` (panel) vs `DELETE /cobrador/rutas/:rutaId/abonos/:abonoId` (APK). Solo el del cobrador tiene consumidor.

**Decisión:** se conservan ambos para no romper contratos; se documenta que el consumidor real es el de `/cobrador/*`.

---

## Cobertura

- Todos los endpoints que consumen el **panel admin** y la **APK** están servidos por el backend. No hay huecos de cobertura.
- Endpoints sin consumidor: **~15** (detallados arriba), todos **conservados** por decisión de esta iteración.

## Comando de verificación

El inventario es documentación; no afecta `scripts/check.sh`. Para re-generar la lista de endpoints:

```bash
cd src && grep -rn "@Controller(" modules --include="*.controller.ts" | sed 's/.*@Controller(//;s/).*//' | sort
```