import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "./admin-user.entity";
import { AdminUserSeedService } from "./admin-users.seed.service";

describe("AdminUserSeedService", () => {
  let seedService: AdminUserSeedService;
  let repo: Repository<AdminUser>;
  let config: ConfigService;

  const mockRepo = {
    count: jest.fn(),
    create: jest.fn((entity: Partial<AdminUser>) => entity as AdminUser),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUserSeedService,
        { provide: getRepositoryToken(AdminUser), useValue: mockRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        PasswordService,
      ],
    }).compile();

    seedService = module.get(AdminUserSeedService);
    repo = module.get(getRepositoryToken(AdminUser));
    config = module.get(ConfigService);
  });

  it("no crea nada si ya existe al menos un administrador", async () => {
    (repo.count as jest.Mock).mockResolvedValue(1);

    await seedService.bootstrap();

    expect(repo.save).not.toHaveBeenCalled();
  });

  it("crea el administrador inicial con credenciales de .env y contraseña hasheada", async () => {
    (repo.count as jest.Mock).mockResolvedValue(0);
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "ADMIN_INITIAL_USERNAME") return "admin";
      if (key === "ADMIN_INITIAL_PASSWORD") return "s3cret-password";
      return undefined;
    });

    await seedService.bootstrap();

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<AdminUser>;
    expect(saved.usuario).toBe("admin");
    expect(saved.passwordHash).not.toBe("s3cret-password");
    expect(await new PasswordService().compare("s3cret-password", saved.passwordHash!)).toBe(true);
  });

  it("no crea nada ni lanza si faltan las variables de entorno", async () => {
    (repo.count as jest.Mock).mockResolvedValue(0);

    await expect(seedService.bootstrap()).resolves.toBeUndefined();

    expect(repo.save).not.toHaveBeenCalled();
  });
});
