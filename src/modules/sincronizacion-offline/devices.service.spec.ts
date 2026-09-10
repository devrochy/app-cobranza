import { NotFoundException } from "@nestjs/common";
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
      cobradorId: 20,
      imei: "imei-abc",
      whatsappNumber: "+59170000000",
      publicKey: "pubkey",
      rutaId: null,
      fechaVinculacion: new Date(),
      createdAt: new Date(),
      ...overrides,
    }) as Device;

  const mockDeviceRepo = {
    create: jest.fn((e: Partial<Device>) => e as Device),
    save: jest.fn(async (e: Partial<Device>) => ({ ...device(), ...e } as Device)),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
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

  describe("registrar (vinculación device ↔ cobrador)", () => {
    const input = {
      cobradorId: 20,
      imei: "imei-abc",
      whatsappNumber: "+59170000000",
      publicKey: "pubkey-x25519",
    };

    it("revoca el dispositivo activo previo del cobrador (vínculo 1:1)", async () => {
      await service.registrar(input);

      expect(deviceRepo.update).toHaveBeenCalledWith(
        { cobradorId: 20, estado: "activo" },
        { estado: "revocado" },
      );
    });

    it("genera codigo + apiKey, guarda el hash y vincula cobrador/imei/whatsapp/publicKey", async () => {
      const result = await service.registrar(input);

      expect(result.codigo).toBeDefined();
      expect(result.apiKey.startsWith(`${result.codigo}.`)).toBe(true);

      const guardado = (mockDeviceRepo.save as jest.Mock).mock.calls[0][0] as Partial<Device>;
      expect(guardado.apiKeyHash).toBeDefined();
      expect(guardado.apiKeyHash).not.toBe(result.apiKey.split(".")[1]);
      expect(guardado.cobradorId).toBe(20);
      expect(guardado.imei).toBe("imei-abc");
      expect(guardado.whatsappNumber).toBe("+59170000000");
      expect(guardado.publicKey).toBe("pubkey-x25519");
      expect(guardado.estado).toBe("activo");
      expect(guardado.fechaVinculacion).toBeInstanceOf(Date);
    });
  });

  describe("listar / revocar / obtenerPorCobrador", () => {
    it("lista los dispositivos mapeados a público", async () => {
      (deviceRepo.find as jest.Mock).mockResolvedValue([device()]);
      const result = await service.listar();
      expect(result[0]).toMatchObject({ id: 1, cobradorId: 20, estado: "activo" });
    });

    it("revoca un dispositivo y devuelve su estado", async () => {
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device());
      (deviceRepo.save as jest.Mock).mockImplementation(async (e: Device) => e);

      const result = await service.revocar(1);

      expect(result.estado).toBe("revocado");
    });

    it("lanza NotFoundException al revocar un dispositivo inexistente", async () => {
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.revocar(999)).rejects.toThrow(NotFoundException);
    });

    it("obtenerPorCobrador busca el dispositivo activo del cobrador", async () => {
      (deviceRepo.findOne as jest.Mock).mockResolvedValue(device());
      const result = await service.obtenerPorCobrador(20);
      expect(result?.cobradorId).toBe(20);
      expect(deviceRepo.findOne).toHaveBeenCalledWith({
        where: { cobradorId: 20, estado: "activo" },
      });
    });
  });

  describe("autenticar", () => {
    it("devuelve el dispositivo para una API key válida", async () => {
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
