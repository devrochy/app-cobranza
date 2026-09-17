import { ForbiddenException } from "@nestjs/common";
import { ACCESO_DENEGADO, assertOwned } from "./ownership";

describe("assertOwned", () => {
  it("permite a un admin operar sobre cualquier cartera", () => {
    expect(() => assertOwned({ propietarioId: 1 }, { rol: "admin", sub: 1 })).not.toThrow();
  });

  it("permite a un propietario operar sobre su propia cartera", () => {
    expect(() => assertOwned({ propietarioId: 5 }, { rol: "propietario", sub: 5 })).not.toThrow();
  });

  it("lanza ForbiddenException si un propietario opera sobre una cartera ajena", () => {
    expect(() => assertOwned({ propietarioId: 5 }, { rol: "propietario", sub: 9 })).toThrow(
      ForbiddenException,
    );
    expect(() => assertOwned({ propietarioId: 5 }, { rol: "propietario", sub: 9 })).toThrow(
      ACCESO_DENEGADO,
    );
  });

  it("permite a un gestor operar sobre su propia cartera", () => {
    expect(() =>
      assertOwned({ propietarioId: 5, gestorId: 20 }, { rol: "gestor", sub: 20 }),
    ).not.toThrow();
  });

  it("lanza ForbiddenException si un gestor opera sobre una cartera ajena", () => {
    expect(() =>
      assertOwned({ propietarioId: 5, gestorId: 20 }, { rol: "gestor", sub: 99 }),
    ).toThrow(ForbiddenException);
  });

  it("lanza ForbiddenException si la cartera no tiene gestor asignado", () => {
    expect(() => assertOwned({ propietarioId: 5 }, { rol: "gestor", sub: 20 })).toThrow(
      ForbiddenException,
    );
  });
});