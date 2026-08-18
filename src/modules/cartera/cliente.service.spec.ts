import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia } from "./cliente-evidencia.entity";
import { CreateClienteInput, ClienteService } from "./cliente.service";

describe("ClienteService", () => {
  let service: ClienteService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let configRepo: Repository<RutaConfig>;
  let evidenciaRepo: Repository<ClienteEvidencia>;

  const baseInput: CreateClienteInput = {
    nombre: "Juan",
    apellido: "Pérez",
    negocio: "Tienda",
    telefonoWhatsapp: "+59171111111",
    latitud: -17.78,
    longitud: -63.18,
    topeMaximoDeuda: 5000,
    latitudDomicilio: -17.79,
    longitudDomicilio: -63.19,
  };

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { create: jest.fn(), save: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockEvidenciaRepo = { create: jest.fn(), save: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        getRepository: jest.fn((entity: unknown) => {
          if (entity === ClienteEvidencia) {
            return mockEvidenciaRepo;
          }
          return mockClienteRepo;
        }),
      }),
    ),
  };

  interface ArchivoSubido {
    originalname: string;
    mimetype: string;
    size: number;
    filename: string;
    path: string;
  }

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

  function archivoFixture(overrides: Partial<ArchivoSubido> = {}): ArchivoSubido {
    return {
      originalname: "foto.jpg",
      mimetype: "image/jpeg",
      size: 2048,
      filename: "abc.jpg",
      path: "/uploads/clientes/abc.jpg",
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClienteService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
        { provide: getRepositoryToken(RutaConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(ClienteEvidencia), useValue: mockEvidenciaRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ClienteService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
    configRepo = module.get(getRepositoryToken(RutaConfig));
    evidenciaRepo = module.get(getRepositoryToken(ClienteEvidencia));
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

    const result = await service.crear(1, baseInput, [], adminContext);

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

    await service.crear(1, baseInput, [], adminContext);

    const creado = (clienteRepo.create as jest.Mock).mock.results[0].value as Partial<Cliente>;
    expect(creado.ubicacion).toEqual({ type: "Point", coordinates: [-63.18, -17.78] });
  });

  it("persiste el tope de deuda y la ubicación de domicilio", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.create as jest.Mock).mockImplementation((e: Partial<Cliente>) => e as Cliente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cliente>) => ({
      id: 1,
      rutaId: 1,
      ...e,
      createdAt: new Date(),
    }) as Cliente);

    const result = await service.crear(1, baseInput, [], adminContext);

    const creado = (clienteRepo.create as jest.Mock).mock.results[0].value as Partial<Cliente>;
    expect(creado.topeMaximoDeuda).toBe(5000);
    expect(creado.ubicacionDomicilio).toEqual({ type: "Point", coordinates: [-63.19, -17.79] });
    expect(result.topeMaximoDeuda).toBe(5000);
    expect(result.latitudDomicilio).toBeCloseTo(-17.79, 5);
    expect(result.longitudDomicilio).toBeCloseTo(-63.19, 5);
  });

  it("no persiste domicilio si no se envía", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.create as jest.Mock).mockImplementation((e: Partial<Cliente>) => e as Cliente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cliente>) => ({
      id: 1,
      rutaId: 1,
      ...e,
      createdAt: new Date(),
    }) as Cliente);

    const sinDomicilio: CreateClienteInput = {
      nombre: baseInput.nombre,
      apellido: baseInput.apellido,
      negocio: baseInput.negocio,
      telefonoWhatsapp: baseInput.telefonoWhatsapp,
      latitud: baseInput.latitud,
      longitud: baseInput.longitud,
    };
    const result = await service.crear(1, sinDomicilio, [], adminContext);

    const creado = (clienteRepo.create as jest.Mock).mock.results[0].value as Partial<Cliente>;
    expect(creado.ubicacionDomicilio).toBeNull();
    expect(result.latitudDomicilio).toBeNull();
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.crear(999, baseInput, [], adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("un socio no puede crear un cliente en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.crear(1, baseInput, [], socioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("persiste las evidencias del cliente (foto facial)", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue({ reconocimientoFacialActivo: false, registroDocumentoCliente: false } as RutaConfig);
    (clienteRepo.create as jest.Mock).mockImplementation((e: Partial<Cliente>) => e as Cliente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (e: Partial<Cliente>) => ({
      id: 1,
      rutaId: 1,
      ...e,
      createdAt: new Date(),
    }) as Cliente);
    (evidenciaRepo.create as jest.Mock).mockImplementation((e: Partial<ClienteEvidencia>) => e as ClienteEvidencia);
    (evidenciaRepo.save as jest.Mock).mockImplementation(async (e: Partial<ClienteEvidencia>) => ({
      id: 1,
      ...e,
    }) as ClienteEvidencia);

    await service.crear(
      1,
      baseInput,
      [{ tipo: "foto_facial", archivo: archivoFixture() }],
      adminContext,
    );

    expect(evidenciaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "foto_facial", nombreOriginal: "foto.jpg" }),
    );
  });

  it("exige foto facial si reconocimientoFacialActivo está activo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue({ reconocimientoFacialActivo: true, registroDocumentoCliente: false } as RutaConfig);

    await expect(service.crear(1, baseInput, [], adminContext)).rejects.toThrow(
      "La foto facial es obligatoria",
    );
  });

  it("exige foto de documento si registroDocumentoCliente está activo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (configRepo.findOne as jest.Mock).mockResolvedValue({ reconocimientoFacialActivo: false, registroDocumentoCliente: true } as RutaConfig);

    await expect(service.crear(1, baseInput, [], adminContext)).rejects.toThrow(
      "La foto de documento es obligatoria",
    );
  });
});
