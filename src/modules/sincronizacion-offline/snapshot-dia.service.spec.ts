import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { generateKeyPairSync } from "crypto";
import { Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { ListaClientesDelDiaService } from "../carteras/lista-clientes-dia.service";
import { CarteraOptimizacionService } from "../carteras/cartera-optimizacion.service";
import { Device } from "./device.entity";
import { SnapshotCryptoService } from "./snapshot-crypto.service";
import { SnapshotDiaPublic, SnapshotDiaService } from "./snapshot-dia.service";

describe("SnapshotDiaService", () => {
  let service: SnapshotDiaService;
  let carteraRepo: Repository<Cartera>;
  let listaClientes: ListaClientesDelDiaService;
  let trayectos: CarteraOptimizacionService;

  const device = (overrides: Partial<Device> = {}): Device =>
    ({ id: 1, gestorId: 20, ...overrides }) as Device;

  const carteraDe = (overrides: Partial<Cartera> = {}): Cartera =>
    ({ id: 5, nombre: "Cartera Centro", gestorId: 20, ...overrides }) as Cartera;

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockLista = { obtener: jest.fn().mockResolvedValue([{ id: 10, nombre: "Ana" }]) };
  const mockTrayectos = { consultar: jest.fn().mockResolvedValue({ trayectos: [] }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotDiaService,
        SnapshotCryptoService,
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: ListaClientesDelDiaService, useValue: mockLista },
        { provide: CarteraOptimizacionService, useValue: mockTrayectos },
      ],
    }).compile();

    service = module.get(SnapshotDiaService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    listaClientes = module.get(ListaClientesDelDiaService);
    trayectos = module.get(CarteraOptimizacionService);
  });

  it("compone cartera + clientes del día + trayectos para una cartera del gestor", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraDe());

    const result = (await service.obtenerSnapshot(device(), 5)) as SnapshotDiaPublic;

    expect(result.cartera).toEqual({ id: 5, nombre: "Cartera Centro" });
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
    expect(result.trayectos).toEqual({ trayectos: [] });
    expect(listaClientes.obtener).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
    expect(trayectos.consultar).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
  });

  it("rechaza si el dispositivo no tiene gestor vinculado", async () => {
    await expect(
      service.obtenerSnapshot(device({ gestorId: null }), 5),
    ).rejects.toThrow(BadRequestException);
  });

  it("lanza NotFound si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.obtenerSnapshot(device(), 5)).rejects.toThrow(NotFoundException);
  });

  it("lanza Forbidden si la cartera no es del gestor del dispositivo", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraDe({ gestorId: 99 }));
    await expect(service.obtenerSnapshot(device(), 5)).rejects.toThrow(ForbiddenException);
  });

  it("devuelve trayectos null si no hay trayecto planificado", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraDe());
    (mockTrayectos.consultar as jest.Mock).mockRejectedValue(new NotFoundException("No hay trayecto"));

    const result = (await service.obtenerSnapshot(device(), 5)) as SnapshotDiaPublic;

    expect(result.trayectos).toBeNull();
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
  });

  it("cifra el snapshot cuando el dispositivo tiene clave pública registrada", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraDe());
    const { publicKey } = generateKeyPairSync("x25519");
    const publicKeyBase64 = Buffer.from(
      publicKey.export({ format: "jwk" }).x as string,
      "base64url",
    ).toString("base64");

    const result = await service.obtenerSnapshot(
      device({ publicKey: publicKeyBase64 }),
      5,
    );

    expect(result).toHaveProperty("cifrado", true);
    expect(result).toHaveProperty("clavePublicaEfimera");
    expect(result).toHaveProperty("nonce");
    expect(result).toHaveProperty("datos");
  });
});
