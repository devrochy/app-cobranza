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

describe("CarteraController", () => {
  let controller: CarteraController;
  let clienteService: ClienteService;
  let prestamoService: PrestamoService;

  const mockClienteService = {
    crear: jest.fn(),
  };

  const mockPrestamoService = {
    crear: jest.fn(),
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
  });

  it("delega al crear un cliente", async () => {
    (clienteService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.crearCliente(1, baseDto, req);

    expect(clienteService.crear).toHaveBeenCalledWith(1, baseDto, { rol: "admin", sub: 1 });
  });

  it("delega al crear un préstamo", async () => {
    (prestamoService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { clienteId: 1, valor: 1000, numCuotas: 8, diasEntreCuotas: 7, latitud: -17.78, longitud: -63.18 };

    await controller.crearPrestamo(1, dto, req);

    expect(prestamoService.crear).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });
});
