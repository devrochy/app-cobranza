import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Device } from "./device.entity";
import { DevicesService } from "./devices.service";

describe("DevicesService", () => {
  let service: DevicesService;
  let deviceRepo: Repository<Device>;

  const device = (overrides: Partial<Device> = {}): Device =>
    ({
      id: 1,
      codigo: "11111111-1111-1111-1111-111111111111",
      apiKeyHash: "hash",
      estado: "activo",
      rutaId: 5,
      ...overrides,
    }) as Device;

  const mockDeviceRepo = {
    create: jest.fn((e: Partial<Device>) => e as Device),
    save: jest.fn(async (e: Partial<Device>) => ({ ...device(), ...e } as Device)),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: getRepositoryToken(Device), useValue: mockDeviceRepo },
        { provide: PasswordService, useValue: new PasswordService() },
      ],
    }).compile();

    service = module.get(DevicesService);
    deviceRepo = module.get(getRepositoryToken(Device));
  });

  describe("registrar", () => {
    it("genera codigo + apiKey con prefijo del codigo y almacena el hash del secreto", async () => {
      const result = await service.registrar({ rutaId: 5 });

      expect(result.codigo).toBeDefined();
      expect(result.apiKey.startsWith(`${result.codigo}.`)).toBe(true);
      expect(result.rutaId).toBe(5);

      const guardado = (mockDeviceRepo.save as jest.Mock).mock.calls[0][0] as Partial<Device>;
      expect(guardado.apiKeyHash).toBeDefined();
      expect(guardado.apiKeyHash).not.toBe(result.apiKey.split(".")[1]);
      expect(guardado.estado).toBe("activo");
    });

    it("permite registrar sin rutaId", async () => {
      const result = await service.registrar();
      expect(result.rutaId).toBeNull();
    });
  });

  describe("autenticar", () => {
    it("devuelve el dispositivo para una API key válida", async () => {
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device());
      const secreto = "secreto-e2e";
      const password = new PasswordService();
      const hash = await password.hash(secreto);
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device({ apiKeyHash: hash }));

      const result = await service.autenticar(`11111111-1111-1111-1111-111111111111.${secreto}`);

      expect(result?.id).toBe(1);
    });

    it("devuelve null si el secreto no coincide", async () => {
      const password = new PasswordService();
      const hash = await password.hash("otro-secreto");
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device({ apiKeyHash: hash }));

      const result = await service.autenticar("11111111-1111-1111-1111-111111111111.secreto-mal");

      expect(result).toBeNull();
    });

    it("devuelve null si el dispositivo no está activo", async () => {
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device({ estado: "revocado" }));

      const result = await service.autenticar("codigo.secreto");

      expect(result).toBeNull();
    });

    it("devuelve null para una API key mal formada", async () => {
      const result = await service.autenticar("sin-formato");
      expect(result).toBeNull();
    });
  });
});