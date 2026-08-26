# Plan del Panel Administrativo (app-cobranza-admin)

- **Estado:** plan aprobado (2026-08-26) — Workstream B; repo separado `devrochy/app-cobranza-admin`
- **Origen:** PRD Épica 5 (docs/APP_REQUIREMENTS.md:78-89) + Fase 1 (PRD 6.1: panel admin en el MVP local). El backend (NestJS, este repo) ya expone todas las APIs, incluidos los endpoints del panel `GET /dashboard` (HU-23) y `GET /conversaciones-ia/panel` (HU-24).

## Stack y arquitectura (decisiones aprobadas)

- **Next.js (App Router) + TypeScript** (ADR-0001 del backend: stack TS end-to-end).
- **UI**: Tailwind CSS + shadcn/ui.
- **Sesión**: JWT access+refresh en **cookie httpOnly**; el backend ya revalida el estado por request (JwtAuthGuard).
- **Consumo de la API**: proxy de Next.js (rewrites same-origin) a `localhost:3000`; **cliente tipado manual** (sin OpenAPI por decisión).
- **Login**: admin (`POST /auth/login`) y socio (`POST /auth/socio/login`).

## Repositorio nuevo

- `devrochy/app-cobranza-admin` (privado).
- Infra mínima al crear: `AGENTS.md` propio (mismas reglas: TDD, GitFlow, DoD), skills `tdd-workflow`/`github-gitflow-cicd` adaptadas, `scripts/check.sh` (lint + typecheck + test), CI (build + test + gitleaks), `.env.example` con `NEXT_PUBLIC_*/API` y `DATABASE` no aplica (el panel no toca BD).

## Fases del panel

### Fase P1 — Cimientos
- Bootstrap Next.js (App Router + TS + Tailwind + shadcn/ui).
- Cliente HTTP tipado para la API + proxy de rewrites.
- Sesión cookie httpOnly (login admin/socio, logout, refresh, manejo de 401).
- Layout base (sidebar, header), guard de rutas.

### Fase P2 — Gestión
- **Socios**: listado/crear/editar/bloquear/permisos/configuración (`socios` API) + **cobros-socio** (historial, registrar pago, `links_pago`).
- **Cobradores**: listado/crear/editar/bloquear/permisos.
- **Rutas**: registro, configuración (`ruta-config`), caja, inyecciones, gastos (con evidencias), notas, estatus/reasignación.
- **Cartera**: clientes (con mapa/ubicaciones), préstamos, cuotas/abonos/pagos, visitas, actualización con aprobación (HU-47).

### Fase P3 — Reportes y operación
- Liquidaciones (generar, historial, exportar Excel).
- Reporte diario de ruta + trayectorias (planificada/real).
- Lista de clientes del día con colores y mapa.

### Fase P4 — Conversaciones y monitoreo
- **Conversaciones Admin↔Socio** (chat, historial, wa.me) — HU-63.
- Historial de conversación con cliente — HU-53.
- **Monitoreo IA** (`GET /conversaciones-ia/panel`) — HU-24.

### Fase P5 — Dashboard
- **Dashboard consolidado** (`GET /dashboard`) — HU-23: cartera activa, mora, cobrado día/semana, gastos, comisiones.
- Vista ejecutiva multi-ruta/socio.

## Consumo de API (referencia rápida)

| Módulo | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/socio/login`, `POST /auth/refresh` |
| Socios | `GET/POST /socios`, `PATCH /socios/:id`, `PATCH /socios/:id/estatus`, `PUT /socios/:id/permisos`, `PATCH /socios/:id/configuracion` |
| Cobradores | `GET/POST /cobradores`, `PATCH /cobradores/:id/estatus`, `PUT /cobradores/:id/permisos` |
| Rutas | `POST /rutas`, `PATCH /rutas/:id`, `PATCH /rutas/:id/configuracion`, `PATCH /rutas/:id/estatus`, `PUT /rutas/:id/ruta-config`, caja/inyecciones/gastos/notas/liquidaciones/dia/... |
| Cartera | `GET/POST /rutas/:rutaId/clientes`, préstamos, cuotas, pagos/abonos, visitas, `.../conversacion` |
| Cobros socio | `GET /cobros-socio`, `POST /cobros-socio/generar`, `POST /cobros-socio/:id/pago`, `GET /conversaciones-socio` |
| Panel | `GET /dashboard`, `GET /conversaciones-ia/panel` |

## Notas
- El enforcement APK del cobrador (permisos de ruta, cobrador_permisos) no aplica al panel (es APK, Fase 2).
- El panel opera con roles admin y socio (los socios ven sus recursos; la API ya valida ownership/permisos).
- La ejecución del panel se hace en el repo `app-cobranza-admin` con su propia sesión de opencode; este documento es el plan rector.