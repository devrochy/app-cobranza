import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { NavegacionClienteService } from "./navegacion-cliente.service";

describe("NavegacionClienteService", () => {
  let service: NavegacionClienteService;
  let rutaRepo: Repository<Ruta>;
  let clienteRepo: Repository<Cliente>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const socioContext = { rol: "socio" as const, sub: 1 };

  const mockRutaRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };

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

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 10,
      rutaId: 1,
      nombre: "Juan",
      apellido: "Perez",
      negocio: "Tienda",
      telefonoWhatsapp: "+59171160000",
      ubicacion: { type: "Point", coordinates: [-63.18, -17.78] },
      ubicacionDomicilio: null,
      topeMaximoDeuda: null,
      estatus: "activo",
      colorRiesgo: "azul",
      createdAt: new Date(),
      ...overrides,
    } as Cliente;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavegacionClienteService,
        { provide: getRepositoryToken(Ruta), useValue: mockRutaRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
      ],
    }).compile();

    service = module.get(NavegacionClienteService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("lanza NotFoundException si la ruta no existe", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.obtener(999, 10, { latitud: -17.77, longitud: -63.17 }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un socio no puede navegar a un cliente de una ruta ajena -> 403", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture({ socioId: 2 }));

    await expect(
      service.obtener(1, 10, { latitud: -17.77, longitud: -63.17 }, socioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe en la ruta", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.obtener(1, 999, { latitud: -17.77, longitud: -63.17 }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("genera los enlaces de navegación desde el origen hasta el negocio del cliente", async () => {
    (rutaRepo.findOne as jest.Mock).mockResolvedValue(rutaFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(clienteFixture());

    const result = await service.obtener(
      1,
      10,
      { latitud: -17.77, longitud: -63.17 },
      adminContext,
    );

    expect(result.googleMapsUrl).toContain("origin=-17.77,-63.17");
    expect(result.googleMapsUrl).toContain("destination=-17.78,-63.18");
    expect(result.wazeUrl).toContain("ll=-17.78,-63.18");
  });
});