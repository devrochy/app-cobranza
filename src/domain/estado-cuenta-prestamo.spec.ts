import {
  construirEstadoCuentaPrestamo,
  construirTextoReporte,
  CuotaEstadoInput,
} from "./estado-cuenta-prestamo";

let seq = 0;

function cuota(overrides: Partial<CuotaEstadoInput> = {}): CuotaEstadoInput {
  seq += 1;
  return {
    cuotaId: seq,
    numeroCuota: 1,
    valorEsperado: 100,
    fechaVencimiento: "2026-09-01",
    estatus: "pendiente",
    ...overrides,
  };
}

describe("construirEstadoCuentaPrestamo", () => {
  it("calcula saldos y abonos acumulados por cuota sin abonos", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 400, numCuotas: 4, tipoInteres: 0 },
      [
        cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01" }),
        cuota({ numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08" }),
        cuota({ numeroCuota: 3, valorEsperado: 100, fechaVencimiento: "2026-09-15", estatus: "pagada" }),
        cuota({ numeroCuota: 4, valorEsperado: 100, fechaVencimiento: "2026-09-22", estatus: "pagada" }),
      ],
      [],
    );

    expect(res.totalAbonos).toBe(0);
    expect(res.saldoPendiente).toBe(200);
    expect(res.proximoVencimiento).toBe("2026-09-01");
    expect(res.cuotas).toHaveLength(4);
    expect(res.cuotas[0]).toMatchObject({
      numeroCuota: 1,
      cuotaId: expect.any(Number),
      saldoPendiente: 100,
      abonosAcumulados: 0,
    });
    expect(res.cuotas[1]).toMatchObject({ numeroCuota: 2, saldoPendiente: 100 });
  });

  it("prorratea los abonos desde la primera cuota no pagada (FIFO)", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 300, numCuotas: 3, tipoInteres: 0 },
      [
        cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pagada" }),
        cuota({ numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08" }),
        cuota({ numeroCuota: 3, valorEsperado: 100, fechaVencimiento: "2026-09-15" }),
      ],
      [{ valor: 50 }, { valor: 25 }],
    );

    expect(res.totalAbonos).toBe(75);
    expect(res.saldoPendiente).toBe(125);
    expect(res.cuotas[0].saldoPendiente).toBe(0);
    expect(res.cuotas[1]).toMatchObject({ abonosAcumulados: 75, saldoPendiente: 25 });
    expect(res.cuotas[2]).toMatchObject({ abonosAcumulados: 75, saldoPendiente: 100 });
  });

  it("el próximo vencimiento ignora cuotas pagadas y no muestra fechas futuras vacías", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 100, numCuotas: 1, tipoInteres: 0 },
      [cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pagada" })],
      [],
    );
    expect(res.proximoVencimiento).toBeNull();
  });

  it("el saldo pendiente del préstamo nunca es negativo (no descuenta más que la deuda)", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 100, numCuotas: 1, tipoInteres: 0 },
      [cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01" })],
      [{ valor: 150 }],
    );
    expect(res.saldoPendiente).toBe(0);
    expect(res.cuotas[0].saldoPendiente).toBe(0);
  });

  it("el próximo vencimiento ignora una cuota pendiente totalmente cubierta por abonos", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 300, numCuotas: 3, tipoInteres: 0 },
      [
        cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01" }),
        cuota({ numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08" }),
        cuota({ numeroCuota: 3, valorEsperado: 100, fechaVencimiento: "2026-09-15" }),
      ],
      [{ valor: 100 }],
    );

    expect(res.proximoVencimiento).toBe("2026-09-08");
  });
});

describe("construirTextoReporte", () => {
  it("genera un texto legible con encabezado, cuotas y totales", () => {
    const res = construirEstadoCuentaPrestamo(
      { valor: 200, numCuotas: 2, tipoInteres: 0 },
      [
        cuota({ numeroCuota: 1, valorEsperado: 100, fechaVencimiento: "2026-09-01", estatus: "pagada" }),
        cuota({ numeroCuota: 2, valorEsperado: 100, fechaVencimiento: "2026-09-08" }),
      ],
      [],
    );
    const texto = construirTextoReporte(
      { valor: 200, numCuotas: 2, tipoInteres: 0 },
      "Juan Pérez",
      res,
      "BOB",
    );

    expect(texto).toContain("Juan Pérez");
    expect(texto).toContain("200");
    expect(texto).toContain("2");
    expect(texto).toContain("Cuota 1");
    expect(texto).toContain("pagada");
    expect(texto).toContain("Cuota 2");
    expect(texto).toContain("100 BOB");
    expect(texto).toContain("Saldo pendiente: 100 BOB");
  });
});
