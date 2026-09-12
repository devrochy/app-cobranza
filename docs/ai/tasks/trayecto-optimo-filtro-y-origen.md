---
estado: completada
tags: [tarea]
---

# Tarea: Trayecto óptimo del día — filtro de fecha + origen desde ubicación del cobrador

- **Origen:** Petición directa del usuario (bug reportado en Manizales: el trayecto del día incluyó al cliente 1238 sin cobro hoy y la ruta generada no era óptima)
- **Estado:** completada (pendiente PR)
- **Fecha inicio:** 2026-09-08

## Objetivo
Que `POST /cobrador/rutas/:rutaId/trayecto` genere el trayecto del día **solo con los clientes que de verdad tienen cobro hoy** (cuota que vence hoy, en mora, o compromiso de pago prometido hoy) y que el orden de las paradas **parta desde la última ubicación conocida del cobrador**.

## Fuera de alcance
- No se cambia la definición de "lista del día" (`ListaClientesDelDiaService`), solo se alinea el filtro del trayecto con esa misma regla.
- No se integra un solver externo (Google Directions/OR-Tools); se conserva el heurístico greedy/vecino más cercano existente.
- El clustering K-means multi-trayecto conserva su heurística; `inicio` mejora el ordenamiento de grupos y la primera parada.
- PRD no tocado; no hay HU explícita para esta corrección (bug real reportado).

## Bloques (checklist TDD)
- [x] Bloque 1: `obtenerClientesDelDia` filtra con la misma regla de "cobro hoy" que la lista del día (vencimiento hoy / mora / promesa hoy) y exige coordenadas.
  - Tests: `src/modules/rutas/ruta-optimizacion.service.spec.ts`
- [x] Bloque 2: `segmentarTrayectos` acepta un punto de inicio opcional y, al darlo, la primera parada es la más cercana a ese punto (mantiene el ancla determinista sin inicio).
  - Tests: `src/domain/segmentacion-trayectos.spec.ts`
- [x] Bloque 3: `generar` consulta la última posición del cobrador (posicion_cobrador) y la pasa como inicio a `segmentarTrayectos`; sin posición, genera igual.
  - Tests: `src/modules/rutas/ruta-optimizacion.service.spec.ts`

## Decisiones tomadas durante la implementación
- Causa raíz del bug: `RutaOptimizacionService.obtenerClientesDelDia` filtraba solo por `cu.estatus IN ('pendiente','atrasada')` **sin** fecha: incluía clientes con cuotas pendientes futuras. La lista del día (`ListaClientesDelDiaService.listarClientesConEstado`) sí aplica la regla de "cobro HOY" (vence hoy / mora / promesa hoy). El trayecto ahora usa esa MISMA regla (HAVING con `fecha_vencimiento = :hoy`, mora y `promesas_pago.fecha_prometida = :hoy`), vía `leftJoin` de cuotas para conservar el caso "cliente con promesa y sin cuotas" (coherente con la lista del día).
- Se agregó `c.ubicacion IS NOT NULL`: una parada sin coordenadas rompe el cálculo de distancias (NaN). Consecuencia de diseño: un cliente sin ubicación no entra al trayecto.
- Posición del cobrador: se lee de `posicion_cobrador` por `(cobradorId = ruta.cobradorId, rutaId)` (mismo criterio que `PosicionCobradorService.registrar`, que guarda bajo el cobrador real de la ruta). Fallback: `requester.sub` solo si el rol es cobrador; sin posición → `inicio` undefined (ancla determinista histórica).
- `segmentarTrayectos(paradas, max, inicio?)`: con inicio, la primera parada de cada trayecto es la más cercana al cobrador y los trayectos se visitan del más cercano al más lejano al inicio. Se conserva el heurístico greedy/vecino más cercano (no se integra solver externo).

## Ambigüedades resueltas con el usuario
- ¿Solo filtrar fecha o también origen del cobrador? → Usuario aprobó **Opción C**: ambas.
- ¿Qué cuenta como "cliente a cobrar hoy"? → La misma regla de `listarClientesConEstado` (cuota vence hoy, mora, o promesa hoy), para que trayecto y lista del día sean consistentes.

## Resultado final (llenar al completar)
- Comandos ejecutados para verificar: `./scripts/check.sh` → verde (lint + typecheck + 101 suites / 887 tests, incluye los 4 tests nuevos del RED del dominio/servicio + hueco de fallback sin cobrador).
- Archivos modificados: `src/domain/segmentacion-trayectos.ts`, `src/domain/segmentacion-trayectos.spec.ts`, `src/modules/rutas/ruta-optimizacion.service.ts`, `src/modules/rutas/ruta-optimizacion.service.spec.ts`
- Revisión `code-reviewer`: **APROBADO CON OBSERVACIONES** (2º intento; el 1º entró en bucle sin veredicto). Observaciones resueltas/registradas:
  - [MEDIA] Regla "cobro HOY" duplicada entre servicios → registrada en `docs/ai/tasks/backlog.md`.
  - [BAJA] Posible recursión infinita en `subdividir`/`kMeans` con coords idénticas (preexistente, no tocado en este cambio) → registrada en backlog.
  - [BAJA] `c.ubicacion IS NOT NULL` no garantiza cast ni descarta (0,0) (preexistente también en `coordenadasDeClientes`) → registrada en backlog.
  - [BAJA] `fechaLocal` duplicado (preexistente) → registrado en backlog.
  - [BAJA] Falta test de fallback `ruta.cobradorId === undefined` con requester no cobrador → **agregado** (test "sin cobrador asignado..." en `ruta-optimizacion.service.spec.ts`).
- Pendientes/seguimiento: validar en Manizales que el cliente 1238 (y cualquier otro sin cobro hoy) ya no aparece en el trayecto; la APK ya envía posición periódicamente (`POST /cobrador/rutas/:rutaId/posicion`), por lo que el origen del cobrador queda disponible tras el primer reporte de posición.