import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia } from "./cliente-evidencia.entity";
import { CambioClientePendiente } from "./cambio-cliente-pendiente.entity";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CreateClienteInput, ClienteService } from "./cliente.service";

describe("ClienteService", () => {
  let service: ClienteService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;
  let configRepo: Repository<RutaConfig>;
  let evidenciaRepo: Repository<ClienteEvidencia>;
  let cambioRepo: Repository<CambioClientePendiente>;

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
  const mockClienteRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockConfigRepo = { findOne: jest.fn() };
  const mockEvidenciaRepo = { create: jest.fn(), save: jest.fn() };
  const mockCambioRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const mockPermisosSocio = { tienePermiso: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        getRepository: jest.fn((entity: unknown) => {
          if (entity === ClienteEvidencia) {
            return mockEvidenciaRepo;
          }
          if (entity === CambioClientePendiente) {
            return mockCambioRepo;
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
        { provide: getRepositoryToken(CambioClientePendiente), useValue: mockCambioRepo },
        { provide: PermisosSocioService, useValue: mockPermisosSocio },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ClienteService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
    configRepo = module.get(getRepositoryToken(RutaConfig));
    evidenciaRepo = module.get(getRepositoryToken(ClienteEvidencia));
    cambioRepo = module.get(getRepositoryToken(CambioClientePendiente));
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

  it("actualiza el cliente directamente si el requester tiene actualizar_cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
    } as Cliente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (c: Cliente) => c);

    const result = (await service.actualizar(
      1,
      1,
      { nombre: "Juan Carlos" },
      socioContext,
    )) as unknown as Cliente;

    expect(clienteRepo.save).toHaveBeenCalled();
    expect(result.nombre).toBe("Juan Carlos");
    expect(cambioRepo.save).not.toHaveBeenCalled();
  });

  it("crea una propuesta pendiente si el requester no tiene actualizar_cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(false);
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
    } as Cliente);
    (cambioRepo.create as jest.Mock).mockImplementation((e: Partial<CambioClientePendiente>) => e as CambioClientePendiente);
    (cambioRepo.save as jest.Mock).mockImplementation(async (e: Partial<CambioClientePendiente>) => ({
      id: 1,
      ...e,
    }) as CambioClientePendiente);

    const result = (await service.actualizar(
      1,
      1,
      { nombre: "Nuevo" },
      socioContext,
    )) as unknown as import("./cambio-cliente-pendiente.entity").CambioClientePendiente;

    expect(cambioRepo.save).toHaveBeenCalled();
    expect(result.estado).toBe("pendiente");
    expect(clienteRepo.save).not.toHaveBeenCalled();
  });

  it("lanza NotFoundException si la ruta no existe al actualizar", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.actualizar(999, 1, { nombre: "X" }, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("aprueba la propuesta y aplica los cambios al cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    const cliente = {
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
    } as Cliente;
    (cambioRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      clienteId: 1,
      camposPropuestos: { nombre: "Nuevo" },
      estado: "pendiente",
      solicitadoPorRol: "socio",
      solicitadoPorId: 1,
      revisadoPor: null,
      revisadoEn: null,
      motivoRechazo: null,
      cliente,
    } as unknown as CambioClientePendiente);
    (cambioRepo.save as jest.Mock).mockImplementation(async (e: Partial<CambioClientePendiente>) => e as CambioClientePendiente);
    (clienteRepo.save as jest.Mock).mockImplementation(async (c: Cliente) => c);

    const result = await service.decidirPropuesta(1, 1, "aprobar", adminContext);

    expect(result.estado).toBe("aprobado");
    expect(cliente.nombre).toBe("Nuevo");
    expect(clienteRepo.save).toHaveBeenCalled();
  });

  it("rechaza la propuesta y registra el motivo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    const cliente = {
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
    } as Cliente;
    (cambioRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      clienteId: 1,
      camposPropuestos: { nombre: "Nuevo" },
      estado: "pendiente",
      solicitadoPorRol: "socio",
      solicitadoPorId: 1,
      revisadoPor: null,
      revisadoEn: null,
      motivoRechazo: null,
      cliente,
    } as unknown as CambioClientePendiente);
    (cambioRepo.save as jest.Mock).mockImplementation(async (e: Partial<CambioClientePendiente>) => e as CambioClientePendiente);

    const result = await service.decidirPropuesta(1, 1, "rechazar", adminContext, "Dato incorrecto");

    expect(result.estado).toBe("rechazado");
    expect(result.motivoRechazo).toBe("Dato incorrecto");
    expect(cliente.nombre).toBe("Juan");
  });

  it("lanza 400 si rechaza sin motivo", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    (cambioRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      clienteId: 1,
      camposPropuestos: { nombre: "Nuevo" },
      estado: "pendiente",
      solicitadoPorRol: "socio",
      solicitadoPorId: 1,
      revisadoPor: null,
      revisadoEn: null,
      motivoRechazo: null,
      cliente: { id: 1 },
    } as unknown as CambioClientePendiente);

    await expect(service.decidirPropuesta(1, 1, "rechazar", adminContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("un socio sin actualizar_cliente no puede decidir -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(false);

    await expect(service.decidirPropuesta(1, 1, "aprobar", socioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("lanza NotFoundException si el cliente no existe al actualizar", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.actualizar(1, 999, { nombre: "X" }, adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("lanza 400 si no hay campos para actualizar", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({ id: 1, rutaId: 1 } as Cliente);

    await expect(service.actualizar(1, 1, {}, adminContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("un socio no puede actualizar un cliente en una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(service.actualizar(1, 1, { nombre: "X" }, socioContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("lanza NotFoundException si la propuesta no existe al decidir", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    (cambioRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.decidirPropuesta(1, 999, "aprobar", adminContext)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("lanza 400 si la propuesta ya fue decidida", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(true);
    (cambioRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      clienteId: 1,
      camposPropuestos: { nombre: "X" },
      estado: "aprobado",
      solicitadoPorRol: "socio",
      solicitadoPorId: 1,
      revisadoPor: 0,
      revisadoEn: new Date(),
      motivoRechazo: null,
      cliente: { id: 1 },
    } as unknown as CambioClientePendiente);

    await expect(service.decidirPropuesta(1, 1, "aprobar", adminContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("permite varias propuestas pendientes para el mismo cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (mockPermisosSocio.tienePermiso as jest.Mock).mockResolvedValue(false);
    (clienteRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Pérez",
      negocio: null,
      telefonoWhatsapp: "+59171111111",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "blanco",
      createdAt: new Date(),
    } as Cliente);
    (cambioRepo.create as jest.Mock).mockImplementation((e: Partial<CambioClientePendiente>) => e as CambioClientePendiente);
    (cambioRepo.save as jest.Mock).mockImplementation(async (e: Partial<CambioClientePendiente>) => ({
      id: 1,
      ...e,
    }) as CambioClientePendiente);

    await service.actualizar(1, 1, { nombre: "A" }, socioContext);
    await service.actualizar(1, 1, { apellido: "B" }, socioContext);

    expect(cambioRepo.save).toHaveBeenCalledTimes(2);
    expect(clienteRepo.save).not.toHaveBeenCalled();
  });
});
