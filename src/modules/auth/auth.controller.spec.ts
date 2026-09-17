import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { AuthService, AuthTokenPayload } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    loginPropietario: jest.fn(),
    loginGestor: jest.fn(),
    refresh: jest.fn(),
    revocar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: "login", ttl: 60000, limit: 5 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it("login delega al servicio y devuelve el par de tokens", async () => {
    const pair = { accessToken: "a", refreshToken: "r" };
    (authService.login as jest.Mock).mockResolvedValue({
      ...pair,
      admin: { id: 1, usuario: "admin", nombre: null, apellido: null },
    });

    const result = await controller.login({ usuario: "admin", password: "s3cret" });

    expect(authService.login).toHaveBeenCalledWith("admin", "s3cret");
    expect(result.accessToken).toBe("a");
  });

  it("loginPropietario delega al servicio", async () => {
    const pair = { accessToken: "a", refreshToken: "r" };
    (authService.loginPropietario as jest.Mock).mockResolvedValue({
      ...pair,
      propietario: { id: 10, usuario: "propietario1", nombre: "Juan", apellido: "Pérez" },
    });

    const result = await controller.loginPropietario({ usuario: "propietario1", password: "s3cret" });

    expect(authService.loginPropietario).toHaveBeenCalledWith("propietario1", "s3cret");
    expect(result.propietario.usuario).toBe("propietario1");
  });

  it("loginGestor delega al servicio", async () => {
    const pair = { accessToken: "a", refreshToken: "r" };
    (authService.loginGestor as jest.Mock).mockResolvedValue({
      ...pair,
      gestor: { id: 20, usuario: "gestor1", nombre: "Carlos", apellido: "López" },
    });

    const result = await controller.loginGestor({
      usuario: "gestor1",
      password: "s3cret",
      imei: "imei-1",
      whatsappNumber: "+59171111111",
    });

    expect(authService.loginGestor).toHaveBeenCalledWith("gestor1", "s3cret", {
      imei: "imei-1",
      whatsappNumber: "+59171111111",
    });
    expect(result.gestor.usuario).toBe("gestor1");
  });

  it("refresh delega al servicio", async () => {
    (authService.refresh as jest.Mock).mockResolvedValue({
      accessToken: "a2",
      refreshToken: "r2",
    });

    const result = await controller.refresh({ refreshToken: "r" });

    expect(authService.refresh).toHaveBeenCalledWith("r");
    expect(result.accessToken).toBe("a2");
  });

  it("logout delega la revocación al servicio", async () => {
    (authService.revocar as jest.Mock).mockResolvedValue(undefined);

    await controller.logout({ refreshToken: "r" });

    expect(authService.revocar).toHaveBeenCalledWith("r");
  });

  it("me devuelve la identidad del usuario del token", () => {
    const req = {
      user: { sub: 1, usuario: "admin", tipo: "access" as const },
    } as unknown as Request & { user: AuthTokenPayload };

    expect(controller.me(req)).toEqual({ id: 1, usuario: "admin" });
  });
});
