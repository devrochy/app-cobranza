import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { AuthService, AuthTokenPayload } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        JwtAuthGuard,
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
