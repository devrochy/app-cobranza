import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { generateKeyPairSync } from "crypto";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { Device } from "./device.entity";
import { SnapshotCryptoService } from "./snapshot-crypto.service";
import { SnapshotDiaPublic, SnapshotDiaService } from "./snapshot-dia.service";

describe("SnapshotDiaService", () => {
  let service: SnapshotDiaService;
  let rutaRepo: Repository<Ruta>;
  let listaClientes: ListaClientesDelDiaService;
  let trayectos: RutaOptimizacionService;

  const device = (overrides: Partial<Device> = {}): Device =>
    ({ id: 1, cobradorId: 20, ...overrides }) as Device;

  const rutaDe = (overrides: Partial<Ruta> = {}): Ruta =>
    ({ id: 5, nombre: "Ruta Centro", cobradorId: 20, ...overrides }) as Ruta;

  const mockRutaRepo = { findOne: jest.fn() };
  const mockLista = { obtener: jest.fn().mockResolvedValue([{ id: 10, nombre: "Ana" }]) };
  const mockTrayectos = { consultar: jest.fn().mockResolvedValue({ trayectos: [] }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotDiaService,
        SnapshotCryptoService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: ListaClientesDelDiaService, useValue: mockLista },
        { provide: RutaOptimizacionService, useValue: mockTrayectos },
      ],
    }).compile();

    service = module.get(SnapshotDiaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    listaClientes = module.get(ListaClientesDelDiaService);
    trayectos = module.get(RutaOptimizacionService);
  });

  it("compone ruta + clientes del día + trayectos para una ruta del cobrador", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaDe());

    const result = (await service.obtenerSnapshot(device(), 5)) as SnapshotDiaPublic;

    expect(result.ruta).toEqual({ id: 5, nombre: "Ruta Centro" });
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
    expect(result.trayectos).toEqual({ trayectos: [] });
    expect(listaClientes.obtener).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
    expect(trayectos.consultar).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
  });

  it("rechaza si el dispositivo no tiene cobrador vinculado", async () => {
    await expect(
      service.obtenerSnapshot(device({ cobradorId: null }), 5),
    ).rejects.toThrow(BadRequestException);
  });

  it("lanza NotFound si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.obtenerSnapshot(device(), 5)).rejects.toThrow(NotFoundException);
  });

  it("lanza Forbidden si la ruta no es del cobrador del dispositivo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaDe({ cobradorId: 99 }));
    await expect(service.obtenerSnapshot(device(), 5)).rejects.toThrow(ForbiddenException);
  });

  it("devuelve trayectos null si no hay trayecto planificado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaDe());
    (mockTrayectos.consultar as jest.Mock).mockRejectedValue(new NotFoundException("No hay trayecto"));

    const result = (await service.obtenerSnapshot(device(), 5)) as SnapshotDiaPublic;

    expect(result.trayectos).toBeNull();
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
  });

  it("cifra el snapshot cuando el dispositivo tiene clave pública registrada", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaDe());
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
