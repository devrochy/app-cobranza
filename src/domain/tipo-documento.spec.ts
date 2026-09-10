import {
  normalizarNumeroDocumento,
  validarNumeroDocumento,
} from "./tipo-documento";

describe("tipo-documento", () => {
  describe("validarNumeroDocumento", () => {
    it("acepta un documento de identidad solo con números (5-15 dígitos)", () => {
      expect(validarNumeroDocumento("ci", "1053796939")).toBe(true);
      expect(validarNumeroDocumento("ci", "1234567")).toBe(true);
      expect(validarNumeroDocumento("ci", "12345")).toBe(true);
    });

    it("rechaza un documento de identidad con letras, guiones o muy corto", () => {
      expect(validarNumeroDocumento("ci", "ABC123")).toBe(false);
      expect(validarNumeroDocumento("ci", "1234")).toBe(false);
      expect(validarNumeroDocumento("ci", "1234567-1P")).toBe(false);
    });

    it("valida pasaporte alfanumérico de 5 a 15", () => {
      expect(validarNumeroDocumento("pasaporte", "AB123456")).toBe(true);
      expect(validarNumeroDocumento("pasaporte", "AB123")).toBe(true);
      expect(validarNumeroDocumento("pasaporte", "AB12")).toBe(false);
    });

    it("valida NIT con dígitos y guiones", () => {
      expect(validarNumeroDocumento("nit", "1234567890")).toBe(true);
      expect(validarNumeroDocumento("nit", "123456789-1")).toBe(true);
      expect(validarNumeroDocumento("nit", "1234")).toBe(false);
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
