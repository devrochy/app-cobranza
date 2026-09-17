import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "./cliente.entity";
import { NavegacionClienteService } from "./navegacion-cliente.service";

describe("NavegacionClienteService", () => {
  let service: NavegacionClienteService;
  let carteraRepo: Repository<Cartera>;
  let clienteRepo: Repository<Cliente>;

  const adminContext = { rol: "admin" as const, sub: 0 };
  const propietarioContext = { rol: "propietario" as const, sub: 1 };

  const mockCarteraRepo = { findOne: jest.fn() };
  const mockClienteRepo = { findOne: jest.fn() };

  function carteraFixture(overrides: Partial<Cartera> = {}): Cartera {
    return {
      id: 1,
      propietarioId: 1,
      gestorId: 1,
      nombre: "Cartera Centro",
      descripcion: null,
      tipoInteres: 20,
      numCuotas: 8,
      moneda: "BOB",
      estatus: "activo",
      createdAt: new Date(),
      ...overrides,
    } as Cartera;
  }

  function clienteFixture(overrides: Partial<Cliente> = {}): Cliente {
    return {
      id: 10,
      carteraId: 1,
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
        { provide: getRepositoryToken(Cartera), useValue: mockCarteraRepo },
        { provide: getRepositoryToken(Cliente), useValue: mockClienteRepo },
      ],
    }).compile();

    service = module.get(NavegacionClienteService);
    carteraRepo = module.get(getRepositoryToken(Cartera));
    clienteRepo = module.get(getRepositoryToken(Cliente));
  });

  it("lanza NotFoundException si la cartera no existe", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.obtener(999, 10, { latitud: -17.77, longitud: -63.17 }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("un propietario no puede navegar a un cliente de una cartera ajena -> 403", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture({ propietarioId: 2 }));

    await expect(
      service.obtener(1, 10, { latitud: -17.77, longitud: -63.17 }, propietarioContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lanza NotFoundException si el cliente no existe en la cartera", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
    (clienteRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.obtener(1, 999, { latitud: -17.77, longitud: -63.17 }, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it("genera los enlaces de navegación desde el origen hasta el negocio del cliente", async () => {
    (carteraRepo.findOne as jest.Mock).mockResolvedValue(carteraFixture());
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