import { detectarIntencion, IntencionIa } from "./intencion-ia";

describe("detectarIntencion", () => {
  it("reconoce consulta_saldo por la palabra 'saldo'", () => {
    expect(detectarIntencion("cuál es mi saldo")).toBe<IntencionIa>("consulta_saldo");
  });

  it("reconoce consulta_saldo por 'cuánto debo'", () => {
    expect(detectarIntencion("cuánto debo")).toBe<IntencionIa>("consulta_saldo");
  });

  it("reconoce consulta_saldo por 'próxima cuota'", () => {
    expect(detectarIntencion("cuándo es mi próxima cuota")).toBe<IntencionIa>("consulta_saldo");
  });

  it("reconoce consulta_saldo por 'vencimiento'", () => {
    expect(detectarIntencion("fecha de vencimiento")).toBe<IntencionIa>("consulta_saldo");
  });

  it("reconoce consulta_saldo por 'deuda'", () => {
    expect(detectarIntencion("cuánto es mi deuda")).toBe<IntencionIa>("consulta_saldo");
  });

  it("reconoce consulta_saldo por 'estado de cuenta'", () => {
    expect(detectarIntencion("quiero mi estado de cuenta")).toBe<IntencionIa>("consulta_saldo");
  });

  it("es insensible a mayúsculas", () => {
    expect(detectarIntencion("SALDO")).toBe<IntencionIa>("consulta_saldo");
  });

  it("devuelve desconocida para un mensaje sin palabras de consulta de saldo", () => {
    expect(detectarIntencion("hola, buenas tardes")).toBe<IntencionIa>("desconocida");
  });

  it("devuelve desconocida para entrada vacía o nula", () => {
    expect(detectarIntencion("")).toBe<IntencionIa>("desconocida");
    expect(detectarIntencion("   ")).toBe<IntencionIa>("desconocida");
    expect(detectarIntencion("   ")).toBe<IntencionIa>("desconocida");
  });

  it("reconoce promesa_pago por 'pago el viernes'", () => {
    expect(detectarIntencion("pago el viernes")).toBe<IntencionIa>("promesa_pago");
  });

  it("reconoce promesa_pago por 'promesa de pago'", () => {
    expect(detectarIntencion("quiero hacer una promesa de pago")).toBe<IntencionIa>("promesa_pago");
  });

  it("reconoce promesa_pago por 'compromiso'", () => {
    expect(detectarIntencion("mi compromiso es pagar el 25")).toBe<IntencionIa>("promesa_pago");
  });

  it("reconoce promesa_pago por 'voy a pagar'", () => {
    expect(detectarIntencion("voy a pagar 100 el lunes")).toBe<IntencionIa>("promesa_pago");
  });
});
