import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { AuthTokenPayload } from "./auth.service";
import { PermisoRequerido } from "./permiso-requerido.decorator";
import { PermisoGuard } from "./permiso.guard";

describe("PermisoGuard", () => {
  let guard: PermisoGuard;
  let permisosPropietario: { tienePermiso: jest.Mock };

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
    permisosPropietario = { tienePermiso: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermisoGuard,
        Reflector,
        { provide: PermisosPropietarioService, useValue: permisosPropietario },
      ],
    }).compile();

    guard = module.get(PermisoGuard);
  });

  it("permite a un admin en cartera admin-only", async () => {
    await expect(
      guard.canActivate(contexto(handler(), { sub: 1, rol: "admin", tipo: "access" })),
    ).resolves.toBe(true);
  });

  it("permite a un admin en cartera con permiso (bypass)", async () => {
    await expect(
      guard.canActivate(
        contexto(handler("registrar_propietario"), { sub: 1, rol: "admin", tipo: "access" }),
      ),
    ).resolves.toBe(true);
  });

  it("permite a un propietario con el permiso habilitado", async () => {
    permisosPropietario.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_propietario"), { sub: 10, rol: "propietario", tipo: "access" }),
      ),
    ).resolves.toBe(true);
    expect(permisosPropietario.tienePermiso).toHaveBeenCalledWith(10, "registrar_propietario");
  });

  it("rechaza a un propietario sin el permiso habilitado", async () => {
    permisosPropietario.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_propietario"), { sub: 10, rol: "propietario", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un propietario en cartera admin-only (sin @PermisoRequerido)", async () => {
    await expect(
      guard.canActivate(contexto(handler(), { sub: 10, rol: "propietario", tipo: "access" })),
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
        contexto(handler("registrar_propietario"), { sub: 10, tipo: "access" } as Partial<AuthTokenPayload>),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
