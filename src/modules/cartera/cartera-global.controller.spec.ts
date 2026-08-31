import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { ClienteService } from "./cliente.service";
import { CarteraGlobalController } from "./cartera-global.controller";

describe("CarteraGlobalController", () => {
  let controller: CarteraGlobalController;
  const mockClienteService = { listarGlobal: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CarteraGlobalController],
      providers: [
        { provide: ClienteService, useValue: mockClienteService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CarteraGlobalController);
  });

  it("delega en el servicio con el contexto y los filtros", async () => {
    (mockClienteService.listarGlobal as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 3, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const query = { busqueda: "juan" };

    await controller.listarClientes(query, req);

    expect(mockClienteService.listarGlobal).toHaveBeenCalledWith(
      { rol: "socio", sub: 3 },
      query,
    );
  });
});