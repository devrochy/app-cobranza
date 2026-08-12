import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let repo: Repository<AdminUser>;
  let socioRepo: Repository<Socio>;

  const PLAIN_PASSWORD = "s3cret-password";
  let hash: string;

  const mockRepo = {
    findOne: jest.fn(),
  };

  const mockSocioRepo = {
    findOne: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: "test-access-secret",
        JWT_EXPIRES_IN: "15m",
        JWT_REFRESH_SECRET: "test-refresh-secret",
        JWT_REFRESH_EXPIRES_IN: "7d",
      };
      return values[key];
    }),
  };

  function adminFixture(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
      id: 1,
      usuario: "admin",
      passwordHash: hash,
      estado: "activo",
      nombre: "Admin",
      apellido: "Root",
      correo: null,
      telefono: null,
      createdAt: new Date(),
      ...overrides,
    } as AdminUser;
  }

  function socioFixture(overrides: Partial<Socio> = {}): Socio {
    return {
      id: 10,
      usuario: "socio1",
      passwordHash: hash,
      estatus: "activo",
      nombre: "Juan",
      apellido: "Pérez",
      correo: "juan@correo.com",
      telefono: "+59170000001",
      codigo: "SC001",
      moneda: "BOB",
      createdAt: new Date(),
      ...overrides,
    } as Socio;
  }

  beforeAll(async () => {
    hash = await new PasswordService().hash(PLAIN_PASSWORD, 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AdminUser), useValue: mockRepo },
        { provide: getRepositoryToken(Socio), useValue: mockSocioRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: new JwtService() },
        PasswordService,
      ],
    }).compile();

    service = module.get(AuthService);
    repo = module.get(getRepositoryToken(AdminUser));
    socioRepo = module.get(getRepositoryToken(Socio));
  });

  async function decodeToken(token: string): Promise<Record<string, unknown>> {
    const jwt = new JwtService();
    return jwt.decode(token) as Record<string, unknown>;
  }

  describe("login", () => {
    it("devuelve access + refresh token para credenciales válidas de un admin activo", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(adminFixture());

      const result = await service.login("admin", PLAIN_PASSWORD);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const accessPayload = await decodeToken(result.accessToken);
      expect(accessPayload.sub).toBe(1);
      expect(accessPayload.usuario).toBe("admin");
      expect(accessPayload.tipo).toBe("access");
      expect(accessPayload.rol).toBe("admin");

      const refreshPayload = await decodeToken(result.refreshToken);
      expect(refreshPayload.sub).toBe(1);
      expect(refreshPayload.tipo).toBe("refresh");
      expect(refreshPayload.rol).toBe("admin");
      expect(refreshPayload.jti).toBeDefined();
    });

    it("rechaza con contraseña incorrecta", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(adminFixture());

      await expect(service.login("admin", "wrong-password")).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza con el mismo error si el usuario no existe (no filtra existencia)", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.login("ghost", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza a un administrador bloqueado", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(
        adminFixture({ estado: "bloqueado" }),
      );

      await expect(service.login("admin", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });
  });

  describe("loginSocio", () => {
    it("devuelve tokens con rol socio para credenciales válidas de un socio activo", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());

      const result = await service.loginSocio("socio1", PLAIN_PASSWORD);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const accessPayload = await decodeToken(result.accessToken);
      expect(accessPayload.sub).toBe(10);
      expect(accessPayload.usuario).toBe("socio1");
      expect(accessPayload.tipo).toBe("access");
      expect(accessPayload.rol).toBe("socio");

      const refreshPayload = await decodeToken(result.refreshToken);
      expect(refreshPayload.rol).toBe("socio");

      expect(result.socio.usuario).toBe("socio1");
    });

    it("rechaza con contraseña incorrecta", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());

      await expect(service.loginSocio("socio1", "wrong-password")).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza con el mismo error si el usuario no existe", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.loginSocio("ghost", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza a un socio bloqueado", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(
        socioFixture({ estatus: "bloqueado" }),
      );

      await expect(service.loginSocio("socio1", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });
  });

  describe("refresh", () => {
    it("rota el refresh token y devuelve un par nuevo con jti distinto", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(adminFixture());

      const loginResult = await service.login("admin", PLAIN_PASSWORD);
      const oldJti = (await decodeToken(loginResult.refreshToken)).jti;

      const rotated = await service.refresh(loginResult.refreshToken);

      expect(rotated.accessToken).toBeDefined();
      const newRefreshPayload = await decodeToken(rotated.refreshToken);
      expect(newRefreshPayload.tipo).toBe("refresh");
      expect(newRefreshPayload.jti).not.toBe(oldJti);
    });

    it("rechaza un token inválido o expirado", async () => {
      const jwt = new JwtService();
      const expired = jwt.sign(
        { sub: 1, tipo: "refresh" },
        { secret: "test-refresh-secret", expiresIn: "-1s" },
      );

      await expect(service.refresh(expired)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rechaza un access token usado como refresh", async () => {
      const jwt = new JwtService();
      const accessToken = jwt.sign(
        { sub: 1, tipo: "access", usuario: "admin" },
        { secret: "test-refresh-secret", expiresIn: "15m" },
      );

      await expect(service.refresh(accessToken)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rechaza el refresh si el admin ya no existe", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 999, tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rechaza el refresh si el admin está bloqueado", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(
        adminFixture({ id: 2, estado: "bloqueado" }),
      );
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 2, tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rota un token de socio consultando la tabla de socios y preservando rol", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(socioFixture());
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 10, rol: "socio", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      const rotated = await service.refresh(validRefresh);

      expect(socioRepo.findOne).toHaveBeenCalled();
      const newAccess = await decodeToken(rotated.accessToken);
      const newRefresh = await decodeToken(rotated.refreshToken);
      expect(newAccess.rol).toBe("socio");
      expect(newAccess.sub).toBe(10);
      expect(newRefresh.rol).toBe("socio");
    });

    it("rechaza el refresh de un socio bloqueado", async () => {
      (socioRepo.findOne as jest.Mock).mockResolvedValue(
        socioFixture({ estatus: "bloqueado" }),
      );
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 10, rol: "socio", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });
  });
});
