import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { CreateClienteInput, ClienteService } from "./cliente.service";

describe("ClienteService", () => {
  let service: ClienteService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;

  const baseInput: CreateClienteInput = {
    nombre: "Juan",
    apellido: "Pérez",
    negocio: "Tienda",
    telefonoWhatsapp: "+59171111111",
    latitud: -17.78,
    longitud: -63.18,
  };

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { create: jest.fn(), save: jest.fn() };

  function rutaFixture(overrides: Partial<Ruta> = {}): Ruta {
    return {
      id: 1,
      socioId: 1,
      cobradorId: 1,
      nombre: "Ruta Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Ruta;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClienteService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
      ],
    }).compile();

    service = module.get(ClienteService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("persiste el cliente con color blanco y estatus activo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.create as jest.Mock).mockImplementation((e: Partial<Cliente>) => e as Cliente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cliente>) => ({
      id: 1,
      rutaId: 1,
      ...e,
      createdAt: new Date(),
    }) as Cliente);

    const result = await service.crear(1, baseInput, adminContext);

    expect(clienteRepo.save).toHaveBeenCalledTimes(1);
    expect(result.nombre).toBe("Juan");
    expect(result.colorRiesgo).toBe("blanco");
    expect(result.estatus).toBe("activo");
    expect(result.rutaId).toBe(1);
    expect(result.latitud).toBeCloseTo(-17.78, 5);
    expect(result.longitud).toBeCloseTo(-63.18, 5);
  });

  it("persiste la ubicación como Point de PostGIS (coordinates = [lng, lat])", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.create as jest.Mock).mockImplementation((e: Partial<Cliente>) => e as Cliente);

    await service.crear(1, baseInput, adminContext);

    const creado = (clienteRepo.create as jest.Mock).mock.results[0].value as Partial<Cliente>;
    expect(creado.ubicacion).toEqual({ type: "Point", coordinates: [-63.18, -17.78] });
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.crear(999, baseInput, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("un socio no puede crear un cliente en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.crear(1, baseInput, socioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
