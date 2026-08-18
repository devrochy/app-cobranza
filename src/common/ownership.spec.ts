import { ForbiddenException } from "@nestjs/common";
import { ACCESO_DENEGADO, assertOwned } from "./ownership";

describe("assertOwned", () => {
  it("permite a un admin operar sobre cualquier ruta", () => {
    expect(() => assertOwned({ socioId: 1 }, { rol: "admin", sub: 1 })).not.toThrow();
  });

  it("permite a un socio operar sobre su propia ruta", () => {
    expect(() => assertOwned({ socioId: 5 }, { rol: "socio", sub: 5 })).not.toThrow();
  });

  it("lanza ForbiddenException si un socio opera sobre una ruta ajena", () => {
    expect(() => assertOwned({ socioId: 5 }, { rol: "socio", sub: 9 })).toThrow(
      ForbiddenException,
    );
    expect(() => assertOwned({ socioId: 5 }, { rol: "socio", sub: 9 })).toThrow(
      ACCESO_DENEGADO,
    );
  });
});
