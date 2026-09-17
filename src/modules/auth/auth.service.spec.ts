import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Device } from "../sincronizacion-offline/device.entity";
import { IntentosAccesoService } from "../sincronizacion-offline/intentos-acceso.service";
import { RefreshTokenRevocado } from "./refresh-token-revocado.entity";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let repo: Repository<AdminUser>;
  let propietarioRepo: Repository<Propietario>;
  let gestorRepo: Repository<Gestor>;

  const PLAIN_PASSWORD = "s3cret-password";
  let hash: string;

  const mockRepo = {
    findOne: jest.fn(),
  };

  const mockPropietarioRepo = {
    findOne: jest.fn(),
  };

  const mockGestorRepo = {
    findOne: jest.fn(),
  };

  const mockDeviceRepo = {
    findOne: jest.fn(),
  };

  const mockIntentosAcceso = {
    registrar: jest.fn().mockResolvedValue({ id: 1 }),
  };

  const mockRevocadoRepo = {
    findOne: jest.fn(),
    upsert: jest.fn(),
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

  function propietarioFixture(overrides: Partial<Propietario> = {}): Propietario {
    return {
      id: 10,
      usuario: "propietario1",
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
    } as Propietario;
  }

  function gestorFixture(overrides: Partial<Gestor> = {}): Gestor {
    return {
      id: 20,
      propietarioId: 10,
      usuario: "gestor1",
      passwordHash: hash,
      nombre: "Carlos",
      apellido: "López",
      correo: "carlos@correo.com",
      telefono: "+59171111111",
      codigo: "CB001",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Gestor;
  }

  beforeAll(async () => {
    hash = await new PasswordService().hash(PLAIN_PASSWORD, 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDeviceRepo.findOne.mockResolvedValue(null);
    mockRevocadoRepo.findOne.mockResolvedValue(null);
    mockRevocadoRepo.upsert.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AdminUser), useValue: mockRepo },
        { provide: getRepositoryToken(Propietario), useValue: mockPropietarioRepo },
        { provide: getRepositoryToken(Gestor), useValue: mockGestorRepo },
        { provide: getRepositoryToken(Device), useValue: mockDeviceRepo },
        { provide: getRepositoryToken(RefreshTokenRevocado), useValue: mockRevocadoRepo },
        { provide: IntentosAccesoService, useValue: mockIntentosAcceso },
        { provide: ConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: new JwtService() },
        PasswordService,
      ],
    }).compile();

    service = module.get(AuthService);
    repo = module.get(getRepositoryToken(AdminUser));
    propietarioRepo = module.get(getRepositoryToken(Propietario));
    gestorRepo = module.get(getRepositoryToken(Gestor));
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

  describe("loginPropietario", () => {
    it("devuelve tokens con rol propietario para credenciales válidas de un propietario activo", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());

      const result = await service.loginPropietario("propietario1", PLAIN_PASSWORD);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const accessPayload = await decodeToken(result.accessToken);
      expect(accessPayload.sub).toBe(10);
      expect(accessPayload.usuario).toBe("propietario1");
      expect(accessPayload.tipo).toBe("access");
      expect(accessPayload.rol).toBe("propietario");

      const refreshPayload = await decodeToken(result.refreshToken);
      expect(refreshPayload.rol).toBe("propietario");

      expect(result.propietario.usuario).toBe("propietario1");
    });

    it("rechaza con contraseña incorrecta", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());

      await expect(service.loginPropietario("propietario1", "wrong-password")).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza con el mismo error si el usuario no existe", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.loginPropietario("ghost", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });

    it("rechaza a un propietario bloqueado", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(
        propietarioFixture({ estatus: "bloqueado" }),
      );

      await expect(service.loginPropietario("propietario1", PLAIN_PASSWORD)).rejects.toThrow(
        "Credenciales inválidas",
      );
    });
  });

  describe("loginGestor", () => {
    it("devuelve tokens con rol gestor para credenciales válidas de un gestor activo", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());

      const result = await service.loginGestor("gestor1", PLAIN_PASSWORD);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const accessPayload = await decodeToken(result.accessToken);
      expect(accessPayload.sub).toBe(20);
      expect(accessPayload.usuario).toBe("gestor1");
      expect(accessPayload.tipo).toBe("access");
      expect(accessPayload.rol).toBe("gestor");

      const refreshPayload = await decodeToken(result.refreshToken);
      expect(refreshPayload.rol).toBe("gestor");

      expect(result.gestor.usuario).toBe("gestor1");
    });

    it("rechaza con contraseña incorrecta", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());

      await expect(
        service.loginGestor("gestor1", "wrong-password"),
      ).rejects.toThrow("Credenciales inválidas");
    });

    it("rechaza con el mismo error si el gestor no existe", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.loginGestor("ghost", PLAIN_PASSWORD),
      ).rejects.toThrow("Credenciales inválidas");
    });

    it("rechaza a un gestor bloqueado", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(
        gestorFixture({ estatus: "bloqueado" }),
      );

      await expect(
        service.loginGestor("gestor1", PLAIN_PASSWORD),
      ).rejects.toThrow("Credenciales inválidas");
    });

    it("permite el login si el gestor aún no tiene device vinculado", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      mockDeviceRepo.findOne.mockResolvedValue(null);

      const result = await service.loginGestor("gestor1", PLAIN_PASSWORD);

      expect(result.accessToken).toBeDefined();
    });

    it("rechaza el login si el IMEI/WhatsApp no coincide con el device vinculado", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      mockDeviceRepo.findOne.mockResolvedValue({
        gestorId: 20,
        imei: "imei-registrado",
        whatsappNumber: "+59171111111",
        estado: "activo",
      } as Device);

      await expect(
        service.loginGestor("gestor1", PLAIN_PASSWORD, {
          imei: "imei-distinto",
          whatsappNumber: "+59171111111",
        }),
      ).rejects.toThrow("Dispositivo no autorizado");

      expect(mockIntentosAcceso.registrar).toHaveBeenCalledWith({
        gestorId: 20,
        imei: "imei-distinto",
        whatsappNumber: "+59171111111",
        motivo: "imei_no_coincide",
      });
    });

    it("permite el login si el IMEI y WhatsApp coinciden con el device vinculado", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      mockDeviceRepo.findOne.mockResolvedValue({
        gestorId: 20,
        imei: "imei-registrado",
        whatsappNumber: "+59171111111",
        estado: "activo",
      } as Device);

      const result = await service.loginGestor("gestor1", PLAIN_PASSWORD, {
        imei: "imei-registrado",
        whatsappNumber: "+59171111111",
      });

      expect(result.accessToken).toBeDefined();
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

    it("revoca el refresh token usado al rotarlo (single-use)", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(adminFixture());

      const loginResult = await service.login("admin", PLAIN_PASSWORD);
      const oldJti = (await decodeToken(loginResult.refreshToken)).jti;

      await service.refresh(loginResult.refreshToken);

      expect(mockRevocadoRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ jti: oldJti }),
        ["jti"],
      );
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

    it("rota un token de propietario consultando la tabla de propietarios y preservando rol", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(propietarioFixture());
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 10, rol: "propietario", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      const rotated = await service.refresh(validRefresh);

      expect(propietarioRepo.findOne).toHaveBeenCalled();
      const newAccess = await decodeToken(rotated.accessToken);
      const newRefresh = await decodeToken(rotated.refreshToken);
      expect(newAccess.rol).toBe("propietario");
      expect(newAccess.sub).toBe(10);
      expect(newRefresh.rol).toBe("propietario");
    });

    it("rechaza el refresh de un propietario bloqueado", async () => {
      (propietarioRepo.findOne as jest.Mock).mockResolvedValue(
        propietarioFixture({ estatus: "bloqueado" }),
      );
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 10, rol: "propietario", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rota un token de gestor consultando la tabla de gestores y preservando rol", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(gestorFixture());
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 20, rol: "gestor", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      const rotated = await service.refresh(validRefresh);

      expect(gestorRepo.findOne).toHaveBeenCalled();
      const newAccess = await decodeToken(rotated.accessToken);
      const newRefresh = await decodeToken(rotated.refreshToken);
      expect(newAccess.rol).toBe("gestor");
      expect(newAccess.sub).toBe(20);
      expect(newRefresh.rol).toBe("gestor");
    });

    it("rechaza el refresh de un gestor bloqueado", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(
        gestorFixture({ estatus: "bloqueado" }),
      );
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 20, rol: "gestor", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rechaza el refresh si el gestor ya no existe", async () => {
      (gestorRepo.findOne as jest.Mock).mockResolvedValue(null);
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 999, rol: "gestor", tipo: "refresh", jti: "abc" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });

    it("rechaza un refresh token cuyo jti está en la blacklist", async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(adminFixture());
      mockRevocadoRepo.findOne.mockResolvedValue({ jti: "jti-revocado" });
      const jwt = new JwtService();
      const validRefresh = jwt.sign(
        { sub: 1, rol: "admin", tipo: "refresh", jti: "jti-revocado" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await expect(service.refresh(validRefresh)).rejects.toThrow(
        "Refresh token inválido",
      );
    });
  });

  describe("revocar", () => {
    it("revoca un refresh token insertando su jti en la blacklist", async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: 1, rol: "admin", tipo: "refresh", jti: "jti-xyz" },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );

      await service.revocar(token);

      expect(mockRevocadoRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ jti: "jti-xyz" }),
        ["jti"],
      );
    });

    it("no lanza si el token es inválido (revocación best-effort)", async () => {
      await expect(service.revocar("no-es-un-token")).resolves.toBeUndefined();
      expect(mockRevocadoRepo.upsert).not.toHaveBeenCalled();
    });

    it("no hace nada si el token no es de tipo refresh", async () => {
      const jwt = new JwtService();
      const access = jwt.sign(
        { sub: 1, rol: "admin", tipo: "access" },
        { secret: "test-refresh-secret", expiresIn: "15m" },
      );

      await service.revocar(access);

      expect(mockRevocadoRepo.upsert).not.toHaveBeenCalled();
    });
  });
});
