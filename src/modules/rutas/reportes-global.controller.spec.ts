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
import { LiquidacionesService } from "./liquidaciones.service";
import { ReportesGlobalController } from "./reportes-global.controller";

describe("ReportesGlobalController", () => {
  let controller: ReportesGlobalController;
  const mockLiquidacionesService = { listarGlobal: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportesGlobalController],
      providers: [
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ReportesGlobalController);
  });

  it("delega en el servicio con el contexto del token", async () => {
    (mockLiquidacionesService.listarGlobal as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 3, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarLiquidaciones(req);

    expect(mockLiquidacionesService.listarGlobal).toHaveBeenCalledWith({
      rol: "socio",
      sub: 3,
    });
  });
});