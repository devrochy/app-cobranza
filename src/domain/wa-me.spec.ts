import { generarLinkWaMe } from "./wa-me";

describe("generarLinkWaMe", () => {
  it("genera el enlace wa.me a partir del teléfono (quita el +)", () => {
    expect(generarLinkWaMe("+59171160000")).toBe("https://wa.me/59171160000");
  });

  it("genera el enlace si el teléfono ya viene sin +", () => {
    expect(generarLinkWaMe("59171160000")).toBe("https://wa.me/59171160000");
  });

  it("normaliza espacios y guiones", () => {
    expect(generarLinkWaMe("+591 7116-0000")).toBe("https://wa.me/59171160000");
  });

  it("devuelve null si el teléfono está vacío", () => {
    expect(generarLinkWaMe("")).toBeNull();
    expect(generarLinkWaMe("   ")).toBeNull();
    expect(generarLinkWaMe(null)).toBeNull();
  });
});