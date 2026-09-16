---
estado: pendiente
tags: [requerimientos, backend]
---

# Requerimientos — Backend (`app-cobranza`)

- **Origen:** validación `app-cobranza-admin/docs/ai/tasks/benchmark-validacion-cobraia.md` (H-92..H-123) — barrido detallista de negocio/seguridad/plataforma.
- **Estado:** pendiente. **Propuestas** (se decide caso por caso).
- **Formato:** tipo, valor, esfuerzo y prioridad. Los bloqueantes de producción están en `requerimientos-produccion.md` (repo admin) y se referencian.

---

## REQ-BE-001 — Mora: recargo y condonación
- **Tipo:** Nuevo · **Valor:** Alto · **Esfuerzo:** M/L · **Prioridad:** P1
- **Estado actual (validado):** `recargoActivo` es config muerta; la mora solo cambia `estatus`; no hay condonación (H-99). PRD 4.2:276 y 3.3:163 la prevén.
- **Historia:** Como negocio quiero cobrar recargo por mora y poder condonarlo para reflejar el riesgo real.
- **Criterios de aceptación (Gherkin):**
  - Dado una cuota atrasada y `recargo_activo`, entonces se aplica el recargo configurado y se refleja en el saldo/estado de cuenta.
  - Dado una condonación autorizada, entonces el recargo se anula con auditoría (actor/motivo).
- **Trazabilidad:** RB-001 (H-99), HU-13/48.

## REQ-BE-002 — Zona horaria financiera unificada
- **Tipo:** Mejora (bug) · **Valor:** Alto · **Esfuerzo:** M · **Prioridad:** P1
- **Estado actual (validado):** mora en UTC vs liquidaciones/notificaciones en hora local (H-100).
- **Criterios de aceptación (Gherkin):**
  - Dado un servidor con TZ ≠ UTC, una cuota que vence hoy no se marca atrasada un día antes, y las ventanas de liquidación coinciden.
- **Trazabilidad:** RB-002 (H-100).

## REQ-BE-003 — Liquidación: incluir abonos en cobrado/comisión y `sumaCartera` correcta
- **Tipo:** Mejora (bug) · **Valor:** Alto · **Esfuerzo:** M · **Prioridad:** P1
- **Estado actual (validado):** `totalCobradoPeriodo/Dia` solo suman `pagos`; `sumaCartera` resta abonos de todo el histórico y excluye préstamos liquidados por abono; diverge del dashboard (H-101).
- **Criterios de aceptación (Gherkin):**
  - Dado un periodo con pagos y abonos, el "total cobrado" y la comisión los incluyen de forma consistente con el dashboard.
  - Dado el cálculo de `sumaCartera`, los abonos se imputan dentro de la ventana correcta.
- **Trazabilidad:** RB-003 (H-101), HU-20.

## REQ-BE-004 — Préstamo pagado por cuotas → `liquidado`
- **Tipo:** Mejora (bug) · **Valor:** Medio · **Esfuerzo:** S · **Prioridad:** P1
- **Estado actual (validado):** solo el abono liquida; un préstamo pagado 100% por cuotas queda `vigente` (H-102).
- **Criterios de aceptación (Gherkin):**
  - Dado un préstamo cuyas cuotas quedan todas pagadas, entonces pasa a `liquidado` y deja de contarse como vigente.
- **Trazabilidad:** RB-004 (H-102).

## REQ-BE-005 — Cupo/tope deuda considera abonos
- **Tipo:** Mejora · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2
- **Estado actual (validado):** `saldoVigente` no resta abonos → bloquea nuevo crédito con deuda real menor (H-103).
- **Criterios de aceptación (Gherkin):**
  - Dado un cliente con abonos, el cupo/tope se evalúa sobre la deuda real (consistente con el estado de cuenta).
- **Trazabilidad:** RB-005 (H-103).

## REQ-BE-006 — Cobro a socio: multi-moneda y pagos parciales
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** suma `costoCobro` sin conversión; pago parcial marca "pagado"; sin backfill si el cron falla (H-104, H-105).
- **Criterios de aceptación (Gherkin):**
  - Dado un socio con rutas en distinta moneda, el cálculo convierte o se documenta la regla.
  - Dado un pago parcial, el cobro queda "parcial" con saldo pendiente e historial.
  - Dado un día sin cron, hay backfill del cobro del periodo.
- **Trazabilidad:** RB-006 (H-104/H-105), HU-60.

## REQ-BE-007 — Feriados por país (días no laborables)
- **Tipo:** Mejora · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** `domingos_y_feriados` solo implementa domingos (H-106).
- **Criterios de aceptación (Gherkin):**
  - Dado un feriado del país de la ruta, no se cuentan como día hábil.
- **Trazabilidad:** RB-007 (H-106), HU-10.

## REQ-BE-008 — Rate limiting en endpoints financieros y re-auth
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** S · **Prioridad:** P2 (ver `REQ-PROD-003`)
- **Estado actual (validado):** throttle solo en login (H-94).
- **Trazabilidad:** RB-008 (H-94).

## REQ-BE-009 — Idempotencia en POST financieros
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2 (ver `REQ-PROD-004`)
- **Trazabilidad:** RB-009 (H-95).

## REQ-BE-010 — Revocación de familia de refresh tokens
- **Tipo:** Mejora · **Valor:** Medio-Alto · **Esfuerzo:** M · **Prioridad:** P2 (ver `REQ-PROD-005`)
- **Trazabilidad:** RB-010 (H-96).

## REQ-BE-011 — Auditoría de eliminación de gastos/inyecciones (actor/motivo)
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2
- **Estado actual (validado):** soft-delete + reversión de caja, sin actor/motivo (H-98).
- **Criterios de aceptación (Gherkin):**
  - Dado eliminar un gasto/inyección, queda registro con actor, motivo y valores antes/después.
- **Trazabilidad:** RB-011 (H-98), HU-48.

## REQ-BE-012 — Promesas de pago con auto-transición (cumplida/incumplida)
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2
- **Estado actual (validado):** solo transición manual; bloquea la métrica de promesas cumplidas (H-107).
- **Criterios de aceptación (Gherkin):**
  - Dado el vencimiento de una promesa sin pago, se marca incumplida; dado el pago, cumplida.
- **Trazabilidad:** RB-012 (H-107), PRD 3.4.

## REQ-BE-013 — HU-52: notificar también a Cobrador/Socio y confirmar abonos
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2
- **Estado actual (validado):** solo notifica al cliente; la confirmación de pago no cubre abonos (H-108).
- **Criterios de aceptación (Gherkin):**
  - Dado un evento de pago/abono, el cobrador/socio recibe aviso según config.
- **Trazabilidad:** RB-013 (H-108), HU-52.

## REQ-BE-014 — HU-62: usar `nombre_oficina_cobro` como remitente
- **Tipo:** Mejora · **Valor:** Bajo-Medio · **Esfuerzo:** S · **Prioridad:** P3
- **Estado actual (validado):** se persiste pero no se usa (H-109).
- **Trazabilidad:** RB-014 (H-109), HU-62.

## REQ-BE-015 — Liquidación automática por periodo
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** solo manual (H-110).
- **Criterios de aceptación (Gherkin):**
  - Dado el periodo configurado (diario/semanal/quincenal/mensual), se genera la liquidación (idempotente) sin solaparse con la manual.
- **Trazabilidad:** RB-015 (H-110), HU-20.

## REQ-BE-016 — Jobs con lock distribuido e idempotencia fuerte
- **Tipo:** Mejora · **Valor:** Bajo · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** sin lock/leader election; reenvíos posibles (H-111, H-123).
- **Trazabilidad:** RB-016 (H-111/H-123).

## REQ-BE-017 — Métricas de negocio (PRD 3.4)
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** solo métricas HTTP (H-118).
- **Criterios de aceptación (Gherkin):**
  - Se exponen métricas de derivación, promesas cumplidas, latencia del asistente, costo por conversación y acuerdos rechazados.
- **Trazabilidad:** RB-017 (H-118).

## REQ-BE-018 — HU-36: recálculo dinámico de ruta
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** L · **Prioridad:** P3
- **Estado actual (validado):** `recalculado:false` siempre (H-112).
- **Trazabilidad:** RB-018 (H-112), HU-36.

## REQ-BE-019 — HU-18/50: reporte diario completo + historial/export
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P2
- **Estado actual (validado):** campos de reporte vacíos y sin historial/export (H-113).
- **Trazabilidad:** RB-019 (H-113), HU-18/50.

## REQ-BE-020 — HU-29: ejecutar refinanciación
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** L · **Prioridad:** P3
- **Estado actual (validado):** solo registra promesa; no reprograma cuotas (H-114).
- **Trazabilidad:** RB-020 (H-114), HU-29.

## REQ-BE-021 — HU-24/33 y HU-26/42: asignación de agente/cierre y alertas reales
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** M · **Prioridad:** P3
- **Estado actual (validado):** sin asignar agente ni cerrar "resuelta"; alertas no-op (H-115, H-116).
- **Trazabilidad:** RB-021 (H-115/H-116), HU-24/26/33/42.

## REQ-BE-022 — HU-25: exponer reglas de negociación IA al panel
- **Tipo:** Mejora · **Valor:** Medio · **Esfuerzo:** S · **Prioridad:** P2
- **Estado actual (validado):** `GET/PUT /reglas-negociacion-ia` sin consumidor (H-117).
- **Trazabilidad:** RB-022 (H-117), HU-25.

## REQ-BE-023 — `rutas.pais` en la entidad
- **Tipo:** Nuevo · **Valor:** Bajo · **Esfuerzo:** S · **Prioridad:** P3
- **Estado actual (validado):** no existe (H-120); PRD 4.2/HU-08 lo exigen.
- **Trazabilidad:** RB-023 (H-120), HU-08.

## REQ-BE-024 — Poblar `mensajes_ia.modelo_usado` y `closed_at`
- **Tipo:** Mejora · **Valor:** Bajo · **Esfuerzo:** S · **Prioridad:** P4
- **Estado actual (validado):** nunca se escriben (H-119).
- **Trazabilidad:** RB-024 (H-119).

## REQ-BE-025 — Conciliación de pagos (Fase 2/3)
- **Tipo:** Nuevo · **Valor:** Medio · **Esfuerzo:** L · **Prioridad:** P4 (Fase 2)
- **Estado actual (validado):** `links_pago` solo guarda `estado`; sin tabla de confirmaciones (H-121).
- **Trazabilidad:** RB-025 (H-121).

## Referencias
- Bloqueantes de producción (migraciones, multi-tenant, device key): `app-cobranza-admin/docs/ai/tasks/requerimientos-produccion.md`.
- Matriz de validación: `app-cobranza-admin/docs/ai/tasks/benchmark-validacion-cobraia.md`.
