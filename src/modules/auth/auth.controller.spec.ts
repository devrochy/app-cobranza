import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { AuthService, AuthTokenPayload } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    loginSocio: jest.fn(),
    loginCobrador: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
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

  it("loginSocio delega al servicio", async () => {
    const pair = { accessToken: "a", refreshToken: "r" };
    (authService.loginSocio as jest.Mock).mockResolvedValue({
      ...pair,
      socio: { id: 10, usuario: "socio1", nombre: "Juan", apellido: "Pérez" },
    });

    const result = await controller.loginSocio({ usuario: "socio1", password: "s3cret" });

    expect(authService.loginSocio).toHaveBeenCalledWith("socio1", "s3cret");
    expect(result.socio.usuario).toBe("socio1");
  });

  it("loginCobrador delega al servicio", async () => {
    const pair = { accessToken: "a", refreshToken: "r" };
    (authService.loginCobrador as jest.Mock).mockResolvedValue({
      ...pair,
      cobrador: { id: 20, usuario: "cobrador1", nombre: "Carlos", apellido: "López" },
    });

    const result = await controller.loginCobrador({
      usuario: "cobrador1",
      password: "s3cret",
    });

    expect(authService.loginCobrador).toHaveBeenCalledWith("cobrador1", "s3cret");
    expect(result.cobrador.usuario).toBe("cobrador1");
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

  it("me devuelve la identidad del usuario del token", () => {
    const req = {
      user: { sub: 1, usuario: "admin", tipo: "access" as const },
    } as unknown as Request & { user: AuthTokenPayload };

    expect(controller.me(req)).toEqual({ id: 1, usuario: "admin" });
  });
});
