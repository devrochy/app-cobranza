import { ConfigService } from "@nestjs/config";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let jwt: JwtService;
  let dataSource: { getRepository: jest.Mock };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-access-secret";
      return undefined;
    }),
  };

  function repoReturning(value: unknown) {
    return { findOne: jest.fn().mockResolvedValue(value) };
  }

  function buildDataSource(byEntity: Record<string, unknown>) {
    return {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === AdminUser) return repoReturning(byEntity[AdminUser.name] ?? null);
        if (entity === Socio) return repoReturning(byEntity[Socio.name] ?? null);
        if (entity === Cobrador) return repoReturning(byEntity[Cobrador.name] ?? null);
        return repoReturning(null);
      }),
    };
  }

  function mockContext(authorization?: string): ExecutionContext {
    const req = { headers: { authorization } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    dataSource = buildDataSource({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    jwt = module.get(JwtService);
  });

  function sign(payload: Record<string, unknown>): string {
    return jwt.sign(payload, { secret: "test-access-secret", expiresIn: "15m" });
  }

  function mockRepoFor(entity: unknown, value: unknown): void {
    dataSource.getRepository.mockImplementation((candidate: unknown) =>
      candidate === entity ? repoReturning(value) : repoReturning(null),
    );
  }

  it("permite un access token de admin activo y adjunta el usuario", async () => {
    mockRepoFor(AdminUser, { id: 1 });
    const token = sign({ sub: 1, usuario: "admin", rol: "admin", tipo: "access" });

    const context = mockContext(`Bearer ${token}`);
    const req = context.switchToHttp().getRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({
      sub: 1,
      usuario: "admin",
      rol: "admin",
      tipo: "access",
    });
  });

  it("permite un access token de socio activo", async () => {
    mockRepoFor(Socio, { id: 10 });
    const token = sign({ sub: 10, usuario: "socio1", rol: "socio", tipo: "access" });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).resolves.toBe(true);
  });

  it("permite un access token de cobrador activo (rol preparado)", async () => {
    mockRepoFor(Cobrador, { id: 20 });
    const token = sign({ sub: 20, usuario: "cobrador1", rol: "cobrador", tipo: "access" });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).resolves.toBe(true);
  });

  it("rechaza un access token de admin bloqueado o inexistente", async () => {
    dataSource.getRepository.mockImplementation(() => repoReturning(null));
    const token = sign({ sub: 1, usuario: "admin", rol: "admin", tipo: "access" });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un access token de socio bloqueado o inexistente", async () => {
    dataSource.getRepository.mockImplementation(() => repoReturning(null));
    const token = sign({ sub: 10, usuario: "socio1", rol: "socio", tipo: "access" });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un access token de cobrador bloqueado o inexistente", async () => {
    dataSource.getRepository.mockImplementation(() => repoReturning(null));
    const token = sign({ sub: 20, usuario: "cobrador1", rol: "cobrador", tipo: "access" });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
      { sub: 1, usuario: "admin", rol: "admin", tipo: "access" },
      { secret: "test-access-secret", expiresIn: "-1s" },
    );

    const context = mockContext(`Bearer ${expired}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un refresh token usado como access", async () => {
    const refreshToken = jwt.sign(
      { sub: 1, rol: "admin", tipo: "refresh", jti: "abc" },
      { secret: "test-access-secret", expiresIn: "7d" },
    );

    const context = mockContext(`Bearer ${refreshToken}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});