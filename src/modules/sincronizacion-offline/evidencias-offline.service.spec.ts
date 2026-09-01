import { BadRequestException } from "@nestjs/common";
import { EvidenciasOfflineService } from "./evidencias-offline.service";

jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import { writeFileSync } from "fs";

describe("EvidenciasOfflineService", () => {
  let service: EvidenciasOfflineService;

  beforeEach(() => {
    service = new EvidenciasOfflineService();
    jest.clearAllMocks();
  });

  it("persiste una evidencia base64 y devuelve ArchivoSubido", () => {
    const base64 = Buffer.from("imagen").toString("base64");
    const [archivo] = service.persistir([
      { nombre: "a.jpg", mimetype: "image/jpeg", base64 },
    ]);

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(archivo.originalname).toBe("a.jpg");
    expect(archivo.mimetype).toBe("image/jpeg");
    expect(archivo.size).toBe(Buffer.from("imagen").length);
    expect(archivo.filename).toMatch(/\.jpg$/);
    expect(archivo.path).toContain("uploads/gastos");
  });

  it("rechaza un mimetype no permitido", () => {
    expect(() =>
      service.persistir([
        { nombre: "a.exe", mimetype: "application/x-msdownload", base64: "AAAA" },
      ]),
    ).toThrow(BadRequestException);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("rechaza una evidencia vacía", () => {
    expect(() =>
      service.persistir([{ nombre: "a.jpg", mimetype: "image/jpeg", base64: "" }]),
    ).toThrow(BadRequestException);
  });
});