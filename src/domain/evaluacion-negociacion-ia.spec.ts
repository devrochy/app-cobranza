import { evaluarNegociacion, ReglasEvaluacion } from "./evaluacion-negociacion-ia";

const REGLAS_VACIAS: ReglasEvaluacion = {
  maxDiasProrroga: 0,
  minAbonoAceptablePct: 0,
  maxReprogramacionesPorCliente: 0,
};

describe("evaluarNegociacion", () => {
  it("aprueba cuando no hay reglas configuradas (valores 0)", () => {
    const res = evaluarNegociacion(
      {
        tipo: "abono_parcial",
        valorPrometido: 10,
        fechaPrometida: "2026-09-10",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      REGLAS_VACIAS,
    );
    expect(res.aprobado).toBe(true);
    expect(res.motivos).toHaveLength(0);
  });

  it("rechaza un abono_parcial que no alcanza el mínimo aceptable", () => {
    const res = evaluarNegociacion(
      {
        tipo: "abono_parcial",
        valorPrometido: 20,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, minAbonoAceptablePct: 25 },
    );
    expect(res.aprobado).toBe(false);
    expect(res.motivos.length).toBeGreaterThan(0);
  });

  it("aprueba un abono_parcial que alcanza el mínimo", () => {
    const res = evaluarNegociacion(
      {
        tipo: "abono_parcial",
        valorPrometido: 30,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, minAbonoAceptablePct: 25 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("rechaza una prórroga que excede max_dias_prorroga", () => {
    const res = evaluarNegociacion(
      {
        tipo: "promesa",
        valorPrometido: 100,
        fechaPrometida: "2026-09-10",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, maxDiasProrroga: 5 },
    );
    expect(res.aprobado).toBe(false);
    expect(res.motivos.length).toBeGreaterThan(0);
  });

  it("aprueba una prórroga dentro del máximo", () => {
    const res = evaluarNegociacion(
      {
        tipo: "promesa",
        valorPrometido: 100,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, maxDiasProrroga: 5 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("aprueba un pago anticipado (fecha prometida antes del vencimiento)", () => {
    const res = evaluarNegociacion(
      {
        tipo: "promesa",
        valorPrometido: 100,
        fechaPrometida: "2026-08-20",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, maxDiasProrroga: 5 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("rechaza una refinanciación que supera max_reprogramaciones_por_cliente", () => {
    const res = evaluarNegociacion(
      {
        tipo: "refinanciacion",
        valorPrometido: 100,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 2,
      },
      { ...REGLAS_VACIAS, maxReprogramacionesPorCliente: 2 },
    );
    expect(res.aprobado).toBe(false);
  });

  it("aprueba una refinanciación dentro del límite de reprogramaciones", () => {
    const res = evaluarNegociacion(
      {
        tipo: "refinanciacion",
        valorPrometido: 100,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 1,
      },
      { ...REGLAS_VACIAS, maxReprogramacionesPorCliente: 2 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("no aplica min_abono_aceptable_pct a una promesa simple", () => {
    const res = evaluarNegociacion(
      {
        tipo: "promesa",
        valorPrometido: 10,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, minAbonoAceptablePct: 25 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("acumula múltiples motivos cuando varias reglas fallan", () => {
    const res = evaluarNegociacion(
      {
        tipo: "abono_parcial",
        valorPrometido: 10,
        fechaPrometida: "2026-09-20",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, minAbonoAceptablePct: 25, maxDiasProrroga: 5 },
    );
    expect(res.aprobado).toBe(false);
    expect(res.motivos.length).toBe(2);
  });

  it("aprueba la prórroga cuando los días son exactamente iguales al máximo (boundary)", () => {
    const res = evaluarNegociacion(
      {
        tipo: "promesa",
        valorPrometido: 100,
        fechaPrometida: "2026-09-06",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, maxDiasProrroga: 5 },
    );
    expect(res.aprobado).toBe(true);
  });

  it("aprueba el abono cuando el valor es exactamente el mínimo (boundary)", () => {
    const res = evaluarNegociacion(
      {
        tipo: "abono_parcial",
        valorPrometido: 25,
        fechaPrometida: "2026-09-03",
        valorCuota: 100,
        fechaVencimientoCuota: "2026-09-01",
        reprogramacionesCliente: 0,
      },
      { ...REGLAS_VACIAS, minAbonoAceptablePct: 25 },
    );
    expect(res.aprobado).toBe(true);
  });
});