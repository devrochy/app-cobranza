import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CarteraController } from "./cartera.controller";
import { ClienteService } from "./cliente.service";
import { PrestamoService } from "./prestamo.service";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { VisitasService } from "./visitas.service";

describe("CarteraController", () => {
  let controller: CarteraController;
  let clienteService: ClienteService;
  let prestamoService: PrestamoService;
  let pagosService: PagosService;
  let abonosService: AbonosService;
  let visitasService: VisitasService;

  const mockClienteService = {
    crear: jest.fn(),
  };

  const mockPrestamoService = {
    crear: jest.fn(),
  };

  const mockPagosService = {
    registrarPagoDeCuota: jest.fn(),
  };

  const mockAbonosService = {
    registrarAbono: jest.fn(),
  };

  const mockVisitasService = {
    registrar: jest.fn(),
  };

  const baseDto = {
    nombre: "Juan",
    apellido: "Pérez",
    telefonoWhatsapp: "+59171111111",
    latitud: -17.78,
    longitud: -63.18,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CarteraController],
      providers: [
        { provide: ClienteService, useValue: mockClienteService },
        { provide: PrestamoService, useValue: mockPrestamoService },
        { provide: PagosService, useValue: mockPagosService },
        { provide: AbonosService, useValue: mockAbonosService },
        { provide: VisitasService, useValue: mockVisitasService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CarteraController);
    clienteService = module.get(ClienteService);
    prestamoService = module.get(PrestamoService);
    pagosService = module.get(PagosService);
    abonosService = module.get(AbonosService);
    visitasService = module.get(VisitasService);
  });

  it("delega al crear un cliente", async () => {
    (clienteService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.crearCliente(
      1,
      baseDto,
      undefined as unknown as {
        foto_facial?: Express.Multer.File[];
        documento_frente?: Express.Multer.File[];
        documento_reverso?: Express.Multer.File[];
      },
      req,
    );

    expect(clienteService.crear).toHaveBeenCalledWith(1, baseDto, [], { rol: "admin", sub: 1 });
  });

  it("delega al crear un préstamo", async () => {
    (prestamoService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { clienteId: 1, valor: 1000, numCuotas: 8, diasEntreCuotas: 7 };

    await controller.crearPrestamo(1, dto, req);

    expect(prestamoService.crear).toHaveBeenCalledWith(
      1,
      { clienteId: 1, valor: 1000, numCuotas: 8, diasEntreCuotas: 7 },
      { rol: "admin", sub: 1 },
      undefined,
    );
  });

  it("delega al registrar un pago de cuota", async () => {
    (pagosService.registrarPagoDeCuota as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { cuotaId: 10, valor: 120, metodoPago: "efectivo" } as const;

    await controller.registrarPago(1, dto, req);

    expect(pagosService.registrarPagoDeCuota).toHaveBeenCalledWith(1, dto, {
      rol: "admin",
      sub: 1,
    });
  });

  it("delega al registrar un abono", async () => {
    (abonosService.registrarAbono as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { prestamoId: 20, valor: 30, metodoPago: "transferencia" } as const;

    await controller.registrarAbono(1, dto, req);

    expect(abonosService.registrarAbono).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al registrar una visita", async () => {
    (visitasService.registrar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { prestamoId: 20, clienteId: 5, resultado: "no_pago", motivoNoPago: "no_esta" } as const;

    await controller.registrarVisita(1, dto, req);

    expect(visitasService.registrar).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });
});
