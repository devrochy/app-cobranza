import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { AuthTokenPayload } from "./auth.service";
import { PermisoRequerido } from "./permiso-requerido.decorator";
import { PermisoGuard } from "./permiso.guard";

describe("PermisoGuard", () => {
  let guard: PermisoGuard;
  let permisosSocio: { tienePermiso: jest.Mock };

  function handler(permiso?: Parameters<typeof PermisoRequerido>[0]): () => void {
    const fn = (): void => undefined;
    if (permiso) {
      PermisoRequerido(permiso)(fn);
    }
    return fn;
  }

  function contexto(handlerFn: () => void, user?: Partial<AuthTokenPayload>): ExecutionContext {
    const req = { user: user ? { ...user } : undefined };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handlerFn,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    permisosSocio = { tienePermiso: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: permisosSocio },
      ],
    }).compile();

    guard = module.get(PermisoGuard);
  });

  it("permite a un admin en ruta admin-only", async () => {
    await expect(
      guard.canActivate(contexto(handler(), { sub: 1, rol: "admin", tipo: "access" })),
    ).resolves.toBe(true);
  });

  it("permite a un admin en ruta con permiso (bypass)", async () => {
    await expect(
      guard.canActivate(
        contexto(handler("registrar_socio"), { sub: 1, rol: "admin", tipo: "access" }),
      ),
    ).resolves.toBe(true);
  });

  it("permite a un socio con el permiso habilitado", async () => {
    permisosSocio.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_socio"), { sub: 10, rol: "socio", tipo: "access" }),
      ),
    ).resolves.toBe(true);
    expect(permisosSocio.tienePermiso).toHaveBeenCalledWith(10, "registrar_socio");
  });

  it("rechaza a un socio sin el permiso habilitado", async () => {
    permisosSocio.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_socio"), { sub: 10, rol: "socio", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un socio en ruta admin-only (sin @PermisoRequerido)", async () => {
    await expect(
      guard.canActivate(contexto(handler(), { sub: 10, rol: "socio", tipo: "access" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza si no hay usuario en la request", async () => {
    await expect(guard.canActivate(contexto(handler()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rechaza un token sin rol", async () => {
    await expect(
      guard.canActivate(
        contexto(handler("registrar_socio"), { sub: 10, tipo: "access" } as Partial<AuthTokenPayload>),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
