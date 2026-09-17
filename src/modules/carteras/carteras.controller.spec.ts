import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request, Response } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { CreateCarteraDto } from "./dto/create-cartera.dto";
import { ListarCarterasDto } from "./dto/listar-carteras.dto";
import { InyeccionesService } from "./inyecciones.service";
import { CarteraConfigService } from "./cartera-config.service";
import { CajaService } from "./caja.service";
import { GastosService } from "./gastos.service";
import { CarterasNotasService } from "./carteras-notas.service";
import { LiquidacionesService } from "./liquidaciones.service";
import { CarterasResumenService } from "./carteras-resumen.service";
import { EstadisticasCarteraService } from "./estadisticas-cartera.service";
import { ReportesDiariosService } from "./reportes-diarios.service";
import { CarteraOptimizacionService } from "./cartera-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { TrayectoriasService } from "./trayectorias.service";
import { PosicionGestorService } from "./posicion-gestor.service";
import { CarterasController } from "./carteras.controller";
import { CarterasService } from "./carteras.service";

describe("CarterasController", () => {
  let controller: CarterasController;
  let service: CarterasService;
  let carteraConfigService: CarteraConfigService;
  let inyeccionesService: InyeccionesService;
  let cajaService: CajaService;
  let gastosService: GastosService;
  let carterasNotasService: CarterasNotasService;
  let liquidacionesService: LiquidacionesService;
  let carterasResumenService: CarterasResumenService;
  let carteraOptimizacionService: CarteraOptimizacionService;
  let listaClientesDelDiaService: ListaClientesDelDiaService;
  let trayectoriasService: TrayectoriasService;

  const mockService = {
    create: jest.fn(),
    listar: jest.fn(),
    setEstatus: jest.fn(),
    reasignarGestor: jest.fn(),
    actualizarInformacion: jest.fn(),
    actualizarConfiguracion: jest.fn(),
  };

  const mockCarteraConfigService = {
    getMatriz: jest.fn(),
    setMatriz: jest.fn(),
  };

  const mockInyeccionesService = {
    crear: jest.fn(),
    eliminar: jest.fn(),
    listar: jest.fn(),
  };

  const mockCajaService = {
    consultar: jest.fn(),
  };

  const mockGastosService = {
    registrar: jest.fn(),
    aprobar: jest.fn(),
    eliminar: jest.fn(),
    listar: jest.fn(),
  };

  const mockCarterasNotasService = {
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

  const mockCarterasResumenService = {
    obtener: jest.fn(),
  };

  const mockEstadisticasCarteraService = {
    obtener: jest.fn(),
  };

  const mockReportesDiariosService = {
    reporteDia: jest.fn(),
    historial: jest.fn(),
    exportarHistorial: jest.fn(),
    fechaDeHoy: jest.fn(() => "2026-09-17"),
  };

  const mockCarteraOptimizacionService = {
    generar: jest.fn(),
    consultar: jest.fn(),
  };

  const mockListaClientesDelDiaService = {
    obtener: jest.fn(),
    obtenerMapa: jest.fn(),
  };

  const mockTrayectoriasService = {
    registrarReal: jest.fn(),
    consultar: jest.fn(),
  };

  const mockPosicionGestorService = {
    registrar: jest.fn(),
    ultimasDelPropietario: jest.fn(),
  };

  const baseDto: CreateCarteraDto = {
    nombre: "Cartera Centro",
    descripcion: "Zona céntrica",
    propietarioId: 1,
    gestorId: 1,
    tipoInteres: 20,
    numCuotas: 8,
    moneda: "BOB",
    saldoInicial: 1000,
    costoCobro: 250,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CarterasController],
      providers: [
        { provide: CarterasService, useValue: mockService },
        { provide: CarteraConfigService, useValue: mockCarteraConfigService },
        { provide: InyeccionesService, useValue: mockInyeccionesService },
        { provide: CajaService, useValue: mockCajaService },
        { provide: GastosService, useValue: mockGastosService },
        { provide: CarterasNotasService, useValue: mockCarterasNotasService },
        { provide: LiquidacionesService, useValue: mockLiquidacionesService },
        { provide: CarterasResumenService, useValue: mockCarterasResumenService },
        { provide: EstadisticasCarteraService, useValue: mockEstadisticasCarteraService },
        { provide: ReportesDiariosService, useValue: mockReportesDiariosService },
        { provide: CarteraOptimizacionService, useValue: mockCarteraOptimizacionService },
        { provide: ListaClientesDelDiaService, useValue: mockListaClientesDelDiaService },
        { provide: TrayectoriasService, useValue: mockTrayectoriasService },
        { provide: PosicionGestorService, useValue: mockPosicionGestorService },
        JwtAuthGuard,
        { provide: DataSource, useValue: {} },
        PermisoGuard,
        Reflector,
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CarterasController);
    service = module.get(CarterasService);
    carteraConfigService = module.get(CarteraConfigService);
    inyeccionesService = module.get(InyeccionesService);
    cajaService = module.get(CajaService);
    gastosService = module.get(GastosService);
    carterasNotasService = module.get(CarterasNotasService);
    liquidacionesService = module.get(LiquidacionesService);
    carterasResumenService = module.get(CarterasResumenService);
    carteraOptimizacionService = module.get(CarteraOptimizacionService);
    listaClientesDelDiaService = module.get(ListaClientesDelDiaService);
    trayectoriasService = module.get(TrayectoriasService);
  });

  it("delega en el servicio con el DTO y el contexto del token", async () => {
    (service.create as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 10, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.create(baseDto, req);

    expect(service.create).toHaveBeenCalledWith(baseDto, { rol: "propietario", sub: 10 });
  });

  it("delega en el servicio al listar carteras con los filtros del query y el contexto", async () => {
    (service.listar as jest.Mock).mockResolvedValue([{ id: 1 }]);
    const query: ListarCarterasDto = { busqueda: "centro", estatus: "activo" };
    const req = { user: { sub: 1, rol: "propietario", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listar(query, req);

    expect(service.listar).toHaveBeenCalledWith(query, { rol: "propietario", sub: 1 });
  });

  it("delega al cambiar el estatus de la cartera", async () => {
    (service.setEstatus as jest.Mock).mockResolvedValue({ id: 1, estatus: "activo" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.setEstatus(1, { estatus: "activo" }, req);

    expect(service.setEstatus).toHaveBeenCalledWith(1, "activo", { rol: "admin", sub: 1 });
  });

  it("delega al reasignar el gestor de la cartera", async () => {
    (service.reasignarGestor as jest.Mock).mockResolvedValue({ id: 1, gestorId: 2 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.reasignarGestor(1, { gestorId: 2 }, req);

    expect(service.reasignarGestor).toHaveBeenCalledWith(1, 2, { rol: "admin", sub: 1 });
  });

  it("delega al editar la información de la cartera", async () => {
    (service.actualizarInformacion as jest.Mock).mockResolvedValue({ id: 1, nombre: "Cartera Norte" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarInformacion(1, { nombre: "Cartera Norte" }, req);

    expect(service.actualizarInformacion).toHaveBeenCalledWith(1, { nombre: "Cartera Norte" }, { rol: "admin", sub: 1 });
  });

  it("delega al editar la configuración de la cartera", async () => {
    (service.actualizarConfiguracion as jest.Mock).mockResolvedValue({ id: 1, tipoInteres: 25 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.actualizarConfiguracion(1, { tipoInteres: 25 }, req);

    expect(service.actualizarConfiguracion).toHaveBeenCalledWith(1, { tipoInteres: 25 }, { rol: "admin", sub: 1 });
  });

  it("delega al consultar la matriz cartera_config", async () => {
    (carteraConfigService.getMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.getCarteraConfig(1, req);

    expect(carteraConfigService.getMatriz).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al configurar la matriz cartera_config", async () => {
    (carteraConfigService.setMatriz as jest.Mock).mockResolvedValue({});
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { mostrarCaja: true };

    await controller.setCarteraConfig(1, dto, req);

    expect(carteraConfigService.setMatriz).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
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

  it("delega al consultar la caja de la cartera", async () => {
    (cajaService.consultar as jest.Mock).mockResolvedValue({
      carteraId: 1,
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

  it("delega al listar los gastos de la cartera", async () => {
    (gastosService.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarGastos(1, req);

    expect(gastosService.listar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al listar las inyecciones de la cartera", async () => {
    (inyeccionesService.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarInyecciones(1, req);

    expect(inyeccionesService.listar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al crear una nota de cartera", async () => {
    (carterasNotasService.crear as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { nota: "Cliente no disponible" };

    await controller.crearNota(1, dto, req);

    expect(carterasNotasService.crear).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al listar las notas de la cartera", async () => {
    (carterasNotasService.listar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.listarNotas(1, req);

    expect(carterasNotasService.listar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al editar una nota de cartera", async () => {
    (carterasNotasService.editar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { nota: "Cliente pagó hoy" };

    await controller.editarNota(1, 10, dto, req);

    expect(carterasNotasService.editar).toHaveBeenCalledWith(1, 10, dto, { rol: "admin", sub: 1 });
  });

  it("delega al eliminar una nota de cartera", async () => {
    (carterasNotasService.eliminar as jest.Mock).mockResolvedValue({ id: 10 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.eliminarNota(1, 10, req);

    expect(carterasNotasService.eliminar).toHaveBeenCalledWith(1, 10, { rol: "admin", sub: 1 });
  });

  it("delega al generar la liquidación de la cartera", async () => {
    (liquidacionesService.generar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { comentario: "cierre" };

    await controller.generarLiquidacion(1, dto, req);

    expect(liquidacionesService.generar).toHaveBeenCalledWith(1, dto, { rol: "admin", sub: 1 });
  });

  it("delega al listar las liquidaciones de la cartera", async () => {
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

  it("delega al obtener el resumen de la cartera", async () => {
    (carterasResumenService.obtener as jest.Mock).mockResolvedValue({ carteraId: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.resumenCartera(1, req);

    expect(carterasResumenService.obtener).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al generar los trayectos del día", async () => {
    (carteraOptimizacionService.generar as jest.Mock).mockResolvedValue([]);
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.generarTrayectos(1, req);

    expect(carteraOptimizacionService.generar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });

  it("delega al consultar los trayectos del día", async () => {
    (carteraOptimizacionService.consultar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.consultarTrayectos(1, req);

    expect(carteraOptimizacionService.consultar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
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

  it("delega al registrar la trayectoria real del día", async () => {
    (trayectoriasService.registrarReal as jest.Mock).mockResolvedValue({ id: 1, tipo: "real" });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };
    const dto = { puntos: [{ latitud: -17.78, longitud: -63.18 }] };

    await controller.registrarTrayectoriaReal(1, dto, req);

    expect(trayectoriasService.registrarReal).toHaveBeenCalledWith(1, dto.puntos, { rol: "admin", sub: 1 });
  });

  it("delega al consultar las trayectorias del día", async () => {
    (trayectoriasService.consultar as jest.Mock).mockResolvedValue({ id: 1 });
    const req = { user: { sub: 1, rol: "admin", tipo: "access" } } as unknown as Request & {
      user: AuthTokenPayload;
    };

    await controller.consultarTrayectorias(1, req);

    expect(trayectoriasService.consultar).toHaveBeenCalledWith(1, { rol: "admin", sub: 1 });
  });
});
