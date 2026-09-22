import { validarFilas } from "./importar-cartera.validacion";
import type { FilaImport } from "./importar-cartera.parser";

function fila(overrides: Partial<FilaImport> = {}): FilaImport {
  return {
    fila: 2,
    nombre: "CARLOS",
    apellido: "PEREZ",
    cedula: "6334116",
    telefono: "59177388488",
    latitud: -17.78,
    longitud: -63.18,
    diasEntreCuotas: 7,
    fecha: "2026-09-14",
    prestamo: 1000,
    interes: 200,
    numCuotas: 24,
    cuotasALaFecha: 5,
    liquido: 5,
    valorTarjeta: 1200,
    valorCuota: 50,
    cobro: 250,
    cuotasCartera: 19,
    cartera: 950,
    ...overrides,
  };
}

describe("validarFilas", () => {
  it("acepta una fila coherente sin errores", () => {
    const r = validarFilas([fila()]);
    expect(r.total).toBe(1);
    expect(r.conErrores).toBe(0);
  });

  it("reporta campos obligatorios faltantes", () => {
    const r = validarFilas([fila({ cedula: "", telefono: "", fecha: "" })]);
    expect(r.errores[0].errores).toEqual(
      expect.arrayContaining(["Falta CEDULA", "Falta TELEFONO", "Falta FECHA"]),
    );
  });

  it("reporta cédula inválida para CI", () => {
    const r = validarFilas([fila({ cedula: "ABC" })]);
    expect(r.errores[0].errores).toContain("Cédula no válida (CI)");
  });

  it("detecta incoherencia en VALOR TARJETA", () => {
    const r = validarFilas([fila({ valorTarjeta: 999 })]);
    expect(r.errores[0].errores).toEqual(
      expect.arrayContaining([expect.stringContaining("VALOR TARJETA no coincide")]),
    );
  });

  it("detecta CUOTAS CARTERA inconsistente (caso fila 2 del archivo)", () => {
    const r = validarFilas([fila({ cuotasCartera: 5 })]);
    expect(r.errores[0].errores).toContain("CUOTAS CARTERA no coincide");
  });

  it("detecta préstamos duplicados por cédula + fecha", () => {
    const r = validarFilas([fila({ fila: 2 }), fila({ fila: 3 })]);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0].fila).toBe(3);
    expect(r.errores[0].errores).toContain("Préstamo duplicado (cédula + fecha)");
  });

  it("acepta dos clientes distintos", () => {
    const r = validarFilas([fila({ fila: 2, cedula: "6334116" }), fila({ fila: 3, cedula: "9759716" })]);
    expect(r.conErrores).toBe(0);
  });
});
