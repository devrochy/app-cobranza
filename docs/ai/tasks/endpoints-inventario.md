# Tarea: Inventario de endpoints backend (panel + APK)

- **Origen:** solicitud del usuario 2026-09-02 (barrido de endpoints, decidir obsolescencia).
- **Estado:** completada
- **Rama:** `docs/endpoints-inventario`
- **Fecha:** 2026-09-02

## Objetivo
Documentar la matriz completa de endpoints del backend NestJS con su consumidor real (panel admin, APK cobrador o ninguno) y la decisión de conservación. **Sin cambios de código.**

## Decisión del usuario
**Documentar y conservar** los endpoints sin consumidor (no eliminar). Entregable: inventario + decisiones registradas.

## Entregable
- `docs/endpoints-inventario.md`: matriz ~90 endpoints por controller con consumidor/estado/nota, sección de conservados (~15), duplicados funcionales (`/rutas/*` vs `/cobrador/*`), y nota de cobertura (sin huecos).

## Verificación
- Documentación pura; `scripts/check.sh` no afectado.
- Comando de re-generación documentado en el propio archivo.