import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { ClienteService } from "./cliente.service";
import { ClientesGlobalController } from "./clientes-global.controller";

describe("ClientesGlobalController", () => {
  let controller: ClientesGlobalController;
  const mockClienteService = { listarGlobal: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientesGlobalController],
      providers: [
        { provide: ClienteService, useValue: mockClienteService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ClientesGlobalController);
  });

  it("delega en el servicio con el contexto y los filtros", async () => {
    (mockClienteService.listarGlobal as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 3, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const query = { busqueda: "juan" };

    await controller.listarClientes(query, req);

    expect(mockClienteService.listarGlobal).toHaveBeenCalledWith(
      { rol: "propietario", sub: 3 },
      query,
    );
  });
});