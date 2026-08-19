import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request, Response } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CreateRutaDto } from "./dto/create-ruta.dto";
import { InyeccionesService } from "./inyecciones.service";
import { RutaConfigService } from "./ruta-config.service";
import { CajaService } from "./caja.service";
import { GastosService } from "./gastos.service";
import { RutasNotasService } from "./rutas-notas.service";
import { LiquidacionesService } from "./liquidaciones.service";
import { RutasResumenService } from "./rutas-resumen.service";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";

describe("RutasController", () => {
  let controller: RutasController;
  let service: RutasService;
  let rutaConfigService: RutaConfigService;
  let inyeccionesService: InyeccionesService;
  let cajaService: CajaService;
  let gastosService: GastosService;
  let rutasNotasService: RutasNotasService;
  let liquidacionesService: LiquidacionesService;
  let rutasResumenService: RutasResumenService;
  let rutaOptimizacionService: RutaOptimizacionService;
  let listaClientesDelDiaService: ListaClientesDelDiaService;

  const mockService = {
    create: jest.fn(),
    setEstatus: jest.fn(),
    reasignarCobrador: jest.fn(),
    actualizarInformacion: jest.fn(),
    actualizarConfiguracion: jest.fn(),
  };

  const mockRutaConfigService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
  };

  const mockInyeccionesService = {
    crear: jest.fn(),
    eliminar: jest.fn(),
  };

  const mockCajaService = {
    consultar: jest.fn(),
  };

  const mockGastosService = {
    registrar: jest.fn(),
    aprobar: jest.fn(),
    eliminar: jest.fn(),
  };

  const mockRutasNotasService = {
    crear: jest.fn(),
    listar: jest.fn(),
    editar: jest.fn(),
    eliminar: jest.fn(),
  };

  const mockLiquidacionesService = {
    generar: jest.fn(),
    listar: jest.fn(),
    exportar: jest.fn(),
  };

  const mockRutasResumenService = {
    obtener: jest.fn(),
  };

  const mockRutaOptimizacionService = {
    generar: jest.fn(),
    consultar: jest.fn(),
  };

  const mockListaClientesDelDiaService = {
    obtener: jest.fn(),
    obtenerMapa: jest.fn(),
  };

  const baseDto: CreateRutaDto = {
    nombre: "Ruta Centro",
    descripcion: "Zona céntrica",
    socioId: 1,
    cobradorId: 1,
    tipoInteres: 20,
    numCuotas: 8,
    moneda: "BOB",
    saldoInicial: 1000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RutasController],
      providers: [
        { provide: RutasService, useValue: mockService },
        { provide: RutaConfigService, useValue: mockRutaConfigService },
        { provide: InyeccionesService, useValue: mockInyeccionesService },
        { provide: CajaService, useValue: mockCajaService },
        { provide: GastosService, useValue: mockGastosService },
        { provide: RutasNotasService, useValue: mockRutasNotasService },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
        { provide: RutasResumenService, useValue: mockRutasResumenService },
        { provide: RutaOptimizacionService, useValue: mockRutaOptimizacionService },
        { provide: ListaClientesDelDiaService, useValue: mockListaClientesDelDiaService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosSocioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(RutasController);
    service = module.get(RutasService);
    rutaConfigService = module.get(RutaConfigService);
    inyeccionesService = module.get(InyeccionesService);
    cajaService = module.get(CajaService);
    gastosService = module.get(GastosService);
    rutasNotasService = module.get(RutasNotasService);
    liquidacionesService = module.get(LiquidacionesService);
    rutasResumenService = module.get(RutasResumenService);
    rutaOptimizacionService = module.get(RutaOptimizacionService);
    listaClientesDelDiaService = module.get(ListaClientesDelDiaService);
  });

  it("delega en el servicio con el DTO y el contexto del token", async () => {
    (service.create as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 10, rol: "socio", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.create(baseDto, req);

    expect(service.create).toHaveBeenCalledWith(baseDto, { rol: "socio", sub: 10 });
  });

  it("delega al cambiar el estatus de la ruta", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "activo" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.setEstatus(1, { estatus: "activo" }, req);

    expect(service.setEstatus).toHaveBeenCalledWith(1, "activo", { rol: "admin", sub: 1 });
  });

  it("delega al reasignar el cobrador de la ruta", async () => {
    (service.reasignarCobrador as jest.Mock).mockResolvedValue({ id: 1, cobradorId: 2 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.reasignarCobrador(1, { cobradorId: 2 }, req);

    expect(service.reasignarCobrador).toHaveBeenCalledWith(1, 2, { rol: "admin", sub: 1 });
  });

  it("delega al editar la información de la ruta", async () => {
    (service.actualizarInformacion as jest.Mock).mockResolvedValue({ id: 1, nombre: "Ruta Norte" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarInformacion(1, { nombre: "Ruta Norte" }, req);

    expect(service.actualizarInformacion).toHaveBeenCalledWith(1, { nombre: "Ruta Norte" }, { rol: "admin", sub: 1 });
  });

  it("delega al editar la configuración de la ruta", async () => {
    (service.actualizarConfiguracion as jest.Mock).mockResolvedValue({ id: 1, tipoInteres: 25 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarConfiguracion(1, { tipoInteres: 25 }, req);

    expect(service.actualizarConfiguracion).toHaveBeenCalledWith(1, { tipoInteres: 25 }, { rol: "admin", sub: 1 });
  });

  it("delega al consultar la matriz ruta_config", async () => {
    (rutaConfigService.getMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getRutaConfig(1, req);

    expect(rutaConfigService.getMatriz).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al configurar la matriz ruta_config", async () => {
    (rutaConfigService.setMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { mostrarCaja: true };

    await controller.setRutaConfig(1, dto, req);

    expect(rutaConfigService.setMatriz).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al registrar una inyección", async () => {
    (inyeccionesService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { valor: 1500, comentario: "Aporte" };

    await controller.crearInyeccion(1, dto, req);

    expect(inyeccionesService.crear).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al eliminar una inyección", async () => {
    (inyeccionesService.eliminar as jest.Mock).mockResolvedValue({ id: 1, estado: "eliminada" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.eliminarInyeccion(1, 10, req);

    expect(inyeccionesService.eliminar).toHaveBeenCalledWith(1, 10, { rol: "admin", sub: 1 });
  });

  it("delega al consultar la caja de la ruta", async () => {
    (cajaService.consultar as jest.Mock).mockResolvedValue({
      rutaId: 1,
      saldoInicial: 1000,
      saldoActual: 1000,
    });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getCaja(1, req);

    expect(cajaService.consultar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al registrar un gasto", async () => {
    (gastosService.registrar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { descripcion: "Combustible", valor: 50 };
    const files = [{ originalname: "f.pdf", path: "/uploads/x.pdf" }] as unknown as Express.Multer.File[];

    await controller.registrarGasto(1, dto, files, req);

    expect(gastosService.registrar).toHaveBeenCalledWith(
      1,
      dto,
      files,
      { rol: "admin", sub: 1 },
    );
  });

  it("delega al aprobar un gasto", async () => {
    (gastosService.aprobar as jest.Mock).mockResolvedValue({ id: 1, aprobado: true });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.aprobarGasto(1, 5, req);

    expect(gastosService.aprobar).toHaveBeenCalledWith(1, 5, { rol: "admin", sub: 1 });
  });

  it("delega al eliminar un gasto", async () => {
    (gastosService.eliminar as jest.Mock).mockResolvedValue({ id: 1, estado: "eliminado" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.eliminarGasto(1, 5, req);

    expect(gastosService.eliminar).toHaveBeenCalledWith(1, 5, { rol: "admin", sub: 1 });
  });

  it("delega al crear una nota de ruta", async () => {
    (rutasNotasService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { nota: "Cliente no disponible" };

    await controller.crearNota(1, dto, req);

    expect(rutasNotasService.crear).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al listar las notas de la ruta", async () => {
    (rutasNotasService.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarNotas(1, req);

    expect(rutasNotasService.listar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al editar una nota de ruta", async () => {
    (rutasNotasService.editar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { nota: "Cliente pagó hoy" };

    await controller.editarNota(1, 10, dto, req);

    expect(rutasNotasService.editar).toHaveBeenCalledWith(1, 10, dto, { rol: "admin", sub: 1 });
  });

  it("delega al eliminar una nota de ruta", async () => {
    (rutasNotasService.eliminar as jest.Mock).mockResolvedValue({ id: 10 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.eliminarNota(1, 10, req);

    expect(rutasNotasService.eliminar).toHaveBeenCalledWith(1, 10, { rol: "admin", sub: 1 });
  });

  it("delega al generar la liquidación de la ruta", async () => {
    (liquidacionesService.generar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { comentario: "cierre" };

    await controller.generarLiquidacion(1, dto, req);

    expect(liquidacionesService.generar).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al listar las liquidaciones de la ruta", async () => {
    (liquidacionesService.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarLiquidaciones(1, req);

    expect(liquidacionesService.listar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al exportar una liquidación y envía el buffer", async () => {
    (liquidacionesService.exportar as jest.Mock).mockResolvedValue({
      buffer: Buffer.from("PK..."),
      filename: "liquidacion-2026-08-19.xlsx",
    });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.exportarLiquidacion(1, 10, req, res);

    expect(liquidacionesService.exportar).toHaveBeenCalledWith(1, 10, { rol: "admin", sub: 1 });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.send).toHaveBeenCalled();
  });

  it("delega al obtener el resumen de la ruta", async () => {
    (rutasResumenService.obtener as jest.Mock).mockResolvedValue({ rutaId: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.resumenRuta(1, req);

    expect(rutasResumenService.obtener).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al generar los trayectos del día", async () => {
    (rutaOptimizacionService.generar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.generarTrayectos(1, req);

    expect(rutaOptimizacionService.generar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al consultar los trayectos del día", async () => {
    (rutaOptimizacionService.consultar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.consultarTrayectos(1, req);

    expect(rutaOptimizacionService.consultar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al obtener la lista de clientes del día", async () => {
    (listaClientesDelDiaService.obtener as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listaClientesDelDia(1, req);

    expect(listaClientesDelDiaService.obtener).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al obtener el mapa de clientes del día", async () => {
    (listaClientesDelDiaService.obtenerMapa as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.mapaClientesDelDia(1, req);

    expect(listaClientesDelDiaService.obtenerMapa).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });
});
