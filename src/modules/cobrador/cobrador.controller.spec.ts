import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { CobradorPermisoGuard } from "../auth/cobrador-permiso.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { RegistrarVisitaDto } from "../cartera/dto/registrar-visita.dto";
import { CobradorService } from "./cobrador.service";
import { CobradorController } from "./cobrador.controller";

describe("CobradorController", () => {
  let controller: CobradorController;
  let service: CobradorService;

  const mockService = {
    misRutas: jest.fn(),
    dia: jest.fn(),
    registrarVisita: jest.fn(),
    registrarGasto: jest.fn(),
    registrarTrayectoriaReal: jest.fn(),
    obtenerTarjeta: jest.fn(),
  };

  function req(sub = 20): Request & { user: AuthTokenPayload } {
    return {
      user: { sub, rol: "cobrador", tipo: "access", usuario: "cobrador1" },
    } as Request & { user: AuthTokenPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobradorController],
      providers: [
        { provide: CobradorService, useValue: mockService },
        JwtAuthGuard,
        CobradorPermisoGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: DataSource, useValue: {} },
        Reflector,
        { provide: CobradoresPermisosService, useValue: { tienePermiso: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CobradorController);
    service = module.get(CobradorService);
  });

  it("misRutas delega con el sub del token", async () => {
    mockService.misRutas.mockResolvedValue([]);

    await expect(controller.misRutas(req())).resolves.toEqual([]);
    expect(service.misRutas).toHaveBeenCalledWith(20);
  });

  it("dia delega con la ruta y el requester del token", async () => {
    mockService.dia.mockResolvedValue({ clientes: [], trayectos: null });

    await expect(controller.dia(6, req())).resolves.toEqual({
      clientes: [],
      trayectos: null,
    });
    expect(service.dia).toHaveBeenCalledWith(6, { rol: "cobrador", sub: 20 });
  });

  it("visitas/pago fija resultado pago y delega", async () => {
    const dto: RegistrarVisitaDto = {
      prestamoId: 1,
      clienteId: 2,
      resultado: "no_pago",
      tipoPago: "cuota",
      cuotaId: 3,
      valor: 100,
      metodoPago: "efectivo",
    };
    mockService.registrarVisita.mockResolvedValue({ id: 1 });

    await expect(controller.registrarVisitaPago(6, dto, req())).resolves.toEqual({ id: 1 });
    expect(service.registrarVisita).toHaveBeenCalledWith(6, {
      ...dto,
      resultado: "pago",
    }, { rol: "cobrador", sub: 20 });
  });

  it("visitas/no-pago fija resultado no_pago y delega", async () => {
    const dto: RegistrarVisitaDto = { prestamoId: 1, clienteId: 2, resultado: "pago" };
    mockService.registrarVisita.mockResolvedValue({ id: 1 });

    await expect(controller.registrarVisitaNoPago(6, dto, req())).resolves.toEqual({ id: 1 });
    expect(service.registrarVisita).toHaveBeenCalledWith(6, {
      ...dto,
      resultado: "no_pago",
    }, { rol: "cobrador", sub: 20 });
  });

  it("gastos delega con archivos (o array vacío) y el requester", async () => {
    const dto = { descripcion: "Combustible", valor: 50 };
    const files = [{ originalname: "a.jpg" }] as unknown as Express.Multer.File[];
    mockService.registrarGasto.mockResolvedValue({ id: 1 });

    await expect(controller.registrarGasto(6, dto, files, req())).resolves.toEqual({ id: 1 });
    expect(service.registrarGasto).toHaveBeenCalledWith(6, dto, files, {
      rol: "cobrador",
      sub: 20,
    });
  });

  it("trayectoria-real delega con los puntos y el requester", async () => {
    const dto = { puntos: [{ latitud: -17.78, longitud: -63.18 }] };
    mockService.registrarTrayectoriaReal.mockResolvedValue({ id: 1, tipo: "real" });

    await expect(controller.registrarTrayectoriaReal(6, dto, req())).resolves.toEqual({
      id: 1,
      tipo: "real",
    });
    expect(service.registrarTrayectoriaReal).toHaveBeenCalledWith(6, dto.puntos, {
      rol: "cobrador",
      sub: 20,
    });
  });

  it("tarjeta delega con ruta, cliente y requester", async () => {
    mockService.obtenerTarjeta.mockResolvedValue({ clienteId: 2 });

    await expect(controller.obtenerTarjeta(6, 2, req())).resolves.toEqual({ clienteId: 2 });
    expect(service.obtenerTarjeta).toHaveBeenCalledWith(6, 2, { rol: "cobrador", sub: 20 });
  });
});