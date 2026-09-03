import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { AuthTokenPayload } from "./auth.service";
import { CobradorPermisoRequerido } from "./cobrador-permiso-requerido.decorator";
import { CobradorPermisoGuard } from "./cobrador-permiso.guard";

describe("CobradorPermisoGuard", () => {
  let guard: CobradorPermisoGuard;
  let permisosCobrador: { tienePermiso: jest.Mock };
  let permisosSocio: { tienePermiso: jest.Mock };

  function handler(
    permiso?: Parameters<typeof CobradorPermisoRequerido>[0],
  ): () => void {
    const fn = (): void => undefined;
    if (permiso) {
      CobradorPermisoRequerido(permiso)(fn);
    }
    return fn;
  }

  function contexto(
    handlerFn: () => void,
    user?: Partial<AuthTokenPayload>,
  ): ExecutionContext {
    const req = { user: user ? { ...user } : undefined };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handlerFn,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    permisosCobrador = { tienePermiso: jest.fn() };
    permisosSocio = { tienePermiso: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobradorPermisoGuard,
        Reflector,
        { provide: CobradoresPermisosService, useValue: permisosCobrador },
        { provide: PermisosSocioService, useValue: permisosSocio },
      ],
    }).compile();

    guard = module.get(CobradorPermisoGuard);
  });

  it("permite a un cobrador con el permiso habilitado en su matriz", async () => {
    permisosCobrador.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_pago"), {
          sub: 20,
          rol: "cobrador",
          tipo: "access",
        }),
      ),
    ).resolves.toBe(true);
    expect(permisosCobrador.tienePermiso).toHaveBeenCalledWith(20, "registrar_pago");
  });

  it("rechaza a un cobrador sin el permiso habilitado", async () => {
    permisosCobrador.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_pago"), {
          sub: 20,
          rol: "cobrador",
          tipo: "access",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un cobrador en ruta sin @CobradorPermisoRequerido", async () => {
    await expect(
      guard.canActivate(
        contexto(handler(), { sub: 20, rol: "cobrador", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite a un socio con el permiso equivalente en su matriz", async () => {
    permisosSocio.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("ver_cartera"), { sub: 10, rol: "socio", tipo: "access" }),
      ),
    ).resolves.toBe(true);
    expect(permisosSocio.tienePermiso).toHaveBeenCalledWith(10, "ver_reportes");
  });

  it("rechaza a un socio sin el permiso equivalente habilitado", async () => {
    permisosSocio.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("ver_cartera"), { sub: 10, rol: "socio", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un socio si el permiso del cobrador no tiene equivalente", async () => {
    await expect(
      guard.canActivate(
        contexto(handler("ver_cartera"), { sub: 10, rol: "admin", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza si no hay usuario en la request", async () => {
    await expect(guard.canActivate(contexto(handler("registrar_pago")))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});