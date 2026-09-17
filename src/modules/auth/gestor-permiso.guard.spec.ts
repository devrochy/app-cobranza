import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { AuthTokenPayload } from "./auth.service";
import { GestorPermisoRequerido } from "./gestor-permiso-requerido.decorator";
import { GestorPermisoGuard } from "./gestor-permiso.guard";

describe("GestorPermisoGuard", () => {
  let guard: GestorPermisoGuard;
  let permisosGestor: { tienePermiso: jest.Mock };
  let permisosPropietario: { tienePermiso: jest.Mock };

  function handler(
    permiso?: Parameters<typeof GestorPermisoRequerido>[0],
  ): () => void {
    const fn = (): void => undefined;
    if (permiso) {
      GestorPermisoRequerido(permiso)(fn);
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
    permisosGestor = { tienePermiso: jest.fn() };
    permisosPropietario = { tienePermiso: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestorPermisoGuard,
        Reflector,
        { provide: GestoresPermisosService, useValue: permisosGestor },
        { provide: PermisosPropietarioService, useValue: permisosPropietario },
      ],
    }).compile();

    guard = module.get(GestorPermisoGuard);
  });

  it("permite a un gestor con el permiso habilitado en su matriz", async () => {
    permisosGestor.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_pago"), {
          sub: 20,
          rol: "gestor",
          tipo: "access",
        }),
      ),
    ).resolves.toBe(true);
    expect(permisosGestor.tienePermiso).toHaveBeenCalledWith(20, "registrar_pago");
  });

  it("rechaza a un gestor sin el permiso habilitado", async () => {
    permisosGestor.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("registrar_pago"), {
          sub: 20,
          rol: "gestor",
          tipo: "access",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un gestor en cartera sin @GestorPermisoRequerido", async () => {
    await expect(
      guard.canActivate(
        contexto(handler(), { sub: 20, rol: "gestor", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite a un propietario con el permiso equivalente en su matriz", async () => {
    permisosPropietario.tienePermiso.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contexto(handler("ver_cartera"), { sub: 10, rol: "propietario", tipo: "access" }),
      ),
    ).resolves.toBe(true);
    expect(permisosPropietario.tienePermiso).toHaveBeenCalledWith(10, "ver_reportes");
  });

  it("rechaza a un propietario sin el permiso equivalente habilitado", async () => {
    permisosPropietario.tienePermiso.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contexto(handler("ver_cartera"), { sub: 10, rol: "propietario", tipo: "access" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza a un propietario si el permiso del gestor no tiene equivalente", async () => {
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