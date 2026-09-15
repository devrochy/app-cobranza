import { redactarSensibles } from "./redact";

describe("redactarSensibles", () => {
  it("redacta PII y secretos sin alterar el resto", () => {
    const entrada = {
      message: "Datos inválidos",
      telefonoWhatsapp: "+59171111111",
      passwordHash: "hash",
      nombre: "Juan",
      statusCode: 400,
    };

    expect(redactarSensibles(entrada)).toEqual({
      message: "Datos inválidos",
      telefonoWhatsapp: "[redactado]",
      passwordHash: "[redactado]",
      nombre: "[redactado]",
      statusCode: 400,
    });
  });

  it("omite artefactos de BD (query/parameters)", () => {
    const error = {
      name: "QueryFailedError",
      query: "SELECT * FROM clientes WHERE telefono = $1",
      parameters: ["+59171111111"],
    };

    expect(redactarSensibles(error)).toEqual({
      name: "QueryFailedError",
      query: "[omitido]",
      parameters: "[omitido]",
    });
  });

  it("redacta recursivamente en objetos anidados y arrays", () => {
    const entrada = {
      clientes: [{ nombre: "Ana", estatus: "activo" }],
      meta: { correo: "a@b.com", total: 1 },
    };

    expect(redactarSensibles(entrada)).toEqual({
      clientes: [{ nombre: "[redactado]", estatus: "activo" }],
      meta: { correo: "[redactado]", total: 1 },
    });
  });

  it("devuelve primitivos y null tal cual", () => {
    expect(redactarSensibles("texto")).toBe("texto");
    expect(redactarSensibles(42)).toBe(42);
    expect(redactarSensibles(null)).toBeNull();
  });
});
