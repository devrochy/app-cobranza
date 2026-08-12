import { ConfigService } from "@nestjs/config";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let jwt: JwtService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-access-secret";
      return undefined;
    }),
  };

  function mockContext(authorization?: string): ExecutionContext {
    const req = { headers: { authorization } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    jwt = module.get(JwtService);
  });

  it("permite un access token válido y adjunta el usuario a la request", async () => {
    const token = jwt.sign(
      { sub: 1, usuario: "admin", tipo: "access" },
      { secret: "test-access-secret", expiresIn: "15m" },
    );

    const context = mockContext(`Bearer ${token}`);
    const req = context.switchToHttp().getRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ sub: 1, usuario: "admin", tipo: "access" });
  });

  it("rechaza si no hay header de autorización", async () => {
    const context = mockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza si el esquema no es Bearer", async () => {
    const context = mockContext("Basic abc123");

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un token inválido o expirado", async () => {
    const expired = jwt.sign(
      { sub: 1, usuario: "admin", tipo: "access" },
      { secret: "test-access-secret", expiresIn: "-1s" },
    );

    const context = mockContext(`Bearer ${expired}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un refresh token usado como access", async () => {
    const refreshToken = jwt.sign(
      { sub: 1, tipo: "refresh", jti: "abc" },
      { secret: "test-access-secret", expiresIn: "7d" },
    );

    const context = mockContext(`Bearer ${refreshToken}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
