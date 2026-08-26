import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { Device } from "./device.entity";
import { SnapshotDiaService } from "./snapshot-dia.service";

describe("SnapshotDiaService", () => {
  let service: SnapshotDiaService;
  let rutaRepo: Repository<Ruta>;
  let listaClientes: ListaClientesDelDiaService;
  let trayectos: RutaOptimizacionService;

  const device = (overrides: Partial<Device> = {}): Device =>
    ({ id: 1, rutaId: 5, ...overrides }) as Device;

  const mockRutaRepo = { findOne: jest.fn() };
  const mockLista = { obtener: jest.fn().mockResolvedValue([{ id: 10, nombre: "Ana" }]) };
  const mockTrayectos = { consultar: jest.fn().mockResolvedValue({ trayectos: [] }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotDiaService,
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

  it("compone ruta + clientes del día + trayectos", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue({ id: 5, nombre: "Ruta Centro" });

    const result = await service.obtenerSnapshot(device());

    expect(result.ruta).toEqual({ id: 5, nombre: "Ruta Centro" });
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
    expect(result.trayectos).toEqual({ trayectos: [] });
    expect(listaClientes.obtener).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
    expect(trayectos.consultar).toHaveBeenCalledWith(5, { rol: "admin", sub: 0 });
  });

  it("rechaza si el dispositivo no tiene ruta asignada", async () => {
    await expect(service.obtenerSnapshot(device({ rutaId: null }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it("lanza NotFound si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.obtenerSnapshot(device())).rejects.toThrow(NotFoundException);
  });

  it("devuelve trayectos null si no hay trayecto planificado", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue({ id: 5, nombre: "Ruta Centro" });
    (mockTrayectos.consultar as jest.Mock).mockRejectedValue(new NotFoundException("No hay trayecto"));

    const result = await service.obtenerSnapshot(device());

    expect(result.trayectos).toBeNull();
    expect(result.clientes).toEqual([{ id: 10, nombre: "Ana" }]);
  });
});