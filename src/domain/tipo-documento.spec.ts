import {
  normalizarNumeroDocumento,
  validarNumeroDocumento,
} from "./tipo-documento";

describe("tipo-documento", () => {
  describe("validarNumeroDocumento", () => {
    it("acepta una CI de 7 dígitos y una con complemento", () => {
      expect(validarNumeroDocumento("ci", "1234567")).toBe(true);
      expect(validarNumeroDocumento("ci", "1234567-1P")).toBe(true);
      expect(validarNumeroDocumento("ci", "12345678 LP")).toBe(true);
    });

    it("rechaza una CI con letras o muy corta", () => {
      expect(validarNumeroDocumento("ci", "ABC123")).toBe(false);
      expect(validarNumeroDocumento("ci", "123")).toBe(false);
    });

    it("valida pasaporte alfanumérico de 6 a 12", () => {
      expect(validarNumeroDocumento("pasaporte", "AB123456")).toBe(true);
      expect(validarNumeroDocumento("pasaporte", "AB123")).toBe(false);
    });

    it("valida NIT solo con dígitos", () => {
      expect(validarNumeroDocumento("nit", "1234567890")).toBe(true);
      expect(validarNumeroDocumento("nit", "123456")).toBe(false);
      expect(validarNumeroDocumento("nit", "12345678A")).toBe(false);
    });

    it("para 'otro' acepta alfanumérico con guiones", () => {
      expect(validarNumeroDocumento("otro", "doc-123")).toBe(true);
    });

    it("normaliza espacios y mayúsculas antes de validar", () => {
      expect(validarNumeroDocumento("pasaporte", "  ab123456  ")).toBe(true);
    });
  });

  describe("normalizarNumeroDocumento", () => {
    it("recorta y pasa a mayúsculas", () => {
      expect(normalizarNumeroDocumento("  ab12 ")).toBe("AB12");
    });
  });
});
