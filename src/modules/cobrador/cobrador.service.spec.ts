import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { AbonosService } from "../cartera/abonos.service";
import { PagosService } from "../cartera/pagos.service";
import { ClienteTarjetaService } from "../cartera/cliente-tarjeta.service";
import { ClienteService } from "../cartera/cliente.service";
import { EstadoCuentaService } from "../cartera/estado-cuenta.service";
import { CuotaService } from "../cartera/cuota.service";
import { PrestamoService } from "../cartera/prestamo.service";
import { RutasAperturaService } from "../rutas/rutas-apertura.service";
import { VisitasService } from "../cartera/visitas.service";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfigService } from "../rutas/ruta-config.service";
import { GastosService } from "../rutas/gastos.service";
import { ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { PosicionCobradorService } from "../rutas/posicion-cobrador.service";
import { DetalleCuotaService } from "../cartera/detalle-cuota.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { RutasNotasService } from "../rutas/rutas-notas.service";
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { CobradorService } from "./cobrador.service";

describe("CobradorService", () => {
  let service: CobradorService;
  let rutaRepo: { find: jest.Mock };
  let rutaConfig: { getMatriz: jest.Mock };
  let permisos: { getMatriz: jest.Mock };
  let listaClientes: { obtener: jest.Mock };
  let optimizacion: { consultar: jest.Mock; generar: jest.Mock };
  let visitas: { registrar: jest.Mock };
  let prestamos: { listarPorCliente: jest.Mock; crear: jest.Mock };
  let gastos: { registrar: jest.Mock };
  let trayectorias: { registrarReal: jest.Mock };
  let tarjeta: { obtener: jest.Mock };
  let clientes: { listar: jest.Mock; crear: jest.Mock; actualizar: jest.Mock };
  let estadoCuenta: { obtener: jest.Mock };
  let cuotas: { editarCuota: jest.Mock; eliminarCuota: jest.Mock };
  let abonos: { eliminarAbono: jest.Mock };
  let pagos: { eliminarPago: jest.Mock };
  let aperturas: { registrar: jest.Mock };
  let posiciones: { registrar: jest.Mock };
  let detalleCuota: { obtener: jest.Mock };
  let permisosSocio: { getMatriz: jest.Mock; tienePermiso: jest.Mock };
  let notas: { listar: jest.Mock; crear: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    rutaRepo = { find: jest.fn() };
    rutaConfig = { getMatriz: jest.fn() };
    permisos = { getMatriz: jest.fn() };
    listaClientes = { obtener: jest.fn() };
    optimizacion = { consultar: jest.fn(), generar: jest.fn() };
    visitas = { registrar: jest.fn() };
    prestamos = { listarPorCliente: jest.fn(), crear: jest.fn() };
    gastos = { registrar: jest.fn() };
    trayectorias = { registrarReal: jest.fn() };
    tarjeta = { obtener: jest.fn() };
    clientes = { listar: jest.fn(), crear: jest.fn(), actualizar: jest.fn() };
    estadoCuenta = { obtener: jest.fn() };
    cuotas = { editarCuota: jest.fn(), eliminarCuota: jest.fn() };
    abonos = { eliminarAbono: jest.fn() };
    pagos = { eliminarPago: jest.fn() };
    aperturas = { registrar: jest.fn() };
    posiciones = { registrar: jest.fn() };
    detalleCuota = { obtener: jest.fn() };
    permisosSocio = { getMatriz: jest.fn(), tienePermiso: jest.fn() };
    notas = { listar: jest.fn(), crear: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobradorService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: RutaConfigService, useValue: rutaConfig },
        { provide: CobradoresPermisosService, useValue: permisos },
        { provide: ListaClientesDelDiaService, useValue: listaClientes },
        { provide: RutaOptimizacionService, useValue: optimizacion },
        { provide: VisitasService, useValue: visitas },
        { provide: PrestamoService, useValue: prestamos },
        { provide: GastosService, useValue: gastos },
        { provide: TrayectoriasService, useValue: trayectorias },
        { provide: ClienteTarjetaService, useValue: tarjeta },
        { provide: ClienteService, useValue: clientes },
        { provide: EstadoCuentaService, useValue: estadoCuenta },
        { provide: CuotaService, useValue: cuotas },
        { provide: AbonosService, useValue: abonos },
        { provide: PagosService, useValue: pagos },
        { provide: RutasAperturaService, useValue: aperturas },
        { provide: PosicionCobradorService, useValue: posiciones },
        { provide: DetalleCuotaService, useValue: detalleCuota },
        { provide: PermisosSocioService, useValue: permisosSocio },
        { provide: RutasNotasService, useValue: notas },
      ],
    }).compile();

    service = module.get(CobradorService);
  });

  describe("misRutas", () => {
    const requester = { rol: "cobrador" as const, sub: 20 };

    it("devuelve array vacío si el cobrador no tiene rutas", async () => {
      rutaRepo.find.mockResolvedValue([]);

      await expect(service.misRutas(requester)).resolves.toEqual([]);
      expect(rutaRepo.find).toHaveBeenCalledWith({
        where: { cobrador: { id: 20 } },
        order: { id: "ASC" },
      });
    });

    it("compone config y permisos por cada ruta del cobrador", async () => {
      rutaRepo.find.mockResolvedValue([
        { id: 6, nombre: "Ruta Centro", estatus: "activo", tipoInteres: 20, numCuotas: 8 },
      ]);
      const config = { rutaId: 6, periodoLiquidacion: "diario" };
      rutaConfig.getMatriz.mockResolvedValue(config);
      const matriz = [{ permiso: "ver_cartera", habilitado: true }];
      permisos.getMatriz.mockResolvedValue(matriz);

      const result = await service.misRutas(requester);

      expect(result).toEqual([
        {
          id: 6,
          nombre: "Ruta Centro",
          estatus: "activo",
          tipoInteres: 20,
          numCuotas: 8,
          config,
          permisos: matriz,
        },
      ]);
      expect(rutaConfig.getMatriz).toHaveBeenCalledWith(6, requester);
      expect(permisos.getMatriz).toHaveBeenCalledWith(20);
    });

    it("para un socio filtra por socioId y mapea sus permisos a nombres de cobrador", async () => {
      const socioRequester = { rol: "socio" as const, sub: 3 };
      rutaRepo.find.mockResolvedValue([
        { id: 9, nombre: "Ruta Norte", estatus: "activo", tipoInteres: 15, numCuotas: 6 },
      ]);
      rutaConfig.getMatriz.mockResolvedValue({ rutaId: 9, periodoLiquidacion: "diario" });
      permisosSocio.getMatriz.mockResolvedValue([
        { permiso: "ver_reportes", habilitado: true },
        { permiso: "configurar_ruta", habilitado: false },
      ]);

      const result = await service.misRutas(socioRequester);

      expect(rutaRepo.find).toHaveBeenCalledWith({
        where: { socio: { id: 3 } },
        order: { id: "ASC" },
      });
      expect(result[0].permisos).toEqual(
        expect.arrayContaining([
          { permiso: "ver_cartera", habilitado: true },
          { permiso: "registrar_pago", habilitado: false },
        ]),
      );
    });
  });

  describe("dia", () => {
    it("compone los clientes del día y el trayecto planificado", async () => {
      const requester = { rol: "cobrador" as const, sub: 20 };
      const clientes = [{ clienteId: 1, nombre: "Juan Pérez", enTrayecto: true, color: "azul" }];
      const trayectos = { ordenClientes: [{ clienteId: 1 }], distanciaEstimadaKm: 3 };
      listaClientes.obtener.mockResolvedValue(clientes);
      optimizacion.consultar.mockResolvedValue(trayectos);

      const result = await service.dia(6, requester);

      expect(result.clientes).toEqual(clientes);
      expect(result.trayectos).toEqual(trayectos);
      expect(listaClientes.obtener).toHaveBeenCalledWith(6, requester);
      expect(optimizacion.consultar).toHaveBeenCalledWith(6, requester);
    });

    it("devuelve trayectos null si no hay trayecto planificado", async () => {
      const requester = { rol: "cobrador" as const, sub: 20 };
      listaClientes.obtener.mockResolvedValue([]);
      optimizacion.consultar.mockRejectedValue(new NotFoundException());

      const result = await service.dia(6, requester);

      expect(result.clientes).toEqual([]);
      expect(result.trayectos).toBeNull();
    });
  });

  describe("operaciones (delegación a servicios de dominio)", () => {
    const requester = { rol: "cobrador" as const, sub: 20 };

    it("registrarVisita delega en VisitasService", async () => {
      const input = { prestamoId: 1, clienteId: 1, resultado: "pago" as const };
      visitas.registrar.mockResolvedValue({ id: 1, resultado: "pago" });

      await expect(service.registrarVisita(6, input, requester)).resolves.toEqual({
        id: 1,
        resultado: "pago",
      });
      expect(visitas.registrar).toHaveBeenCalledWith(6, input, requester);
    });

    it("registrarGasto delega en GastosService con los archivos", async () => {
      const input = { descripcion: "Combustible", valor: 50 };
      const archivos = [
        {
          originalname: "a.jpg",
          mimetype: "image/jpeg",
          size: 1000,
          filename: "x.jpg",
          path: "/tmp/x.jpg",
        },
      ];
      gastos.registrar.mockResolvedValue({ id: 1, descripcion: "Combustible" });

      await expect(service.registrarGasto(6, input, archivos, requester)).resolves.toEqual({
        id: 1,
        descripcion: "Combustible",
      });
      expect(gastos.registrar).toHaveBeenCalledWith(6, input, archivos, requester);
    });

    it("registrarTrayectoriaReal delega en TrayectoriasService", async () => {
      const puntos = [{ latitud: -17.78, longitud: -63.18 }];
      trayectorias.registrarReal.mockResolvedValue({ id: 1, tipo: "real" });

      await expect(service.registrarTrayectoriaReal(6, puntos, requester)).resolves.toEqual({
        id: 1,
        tipo: "real",
      });
      expect(trayectorias.registrarReal).toHaveBeenCalledWith(6, puntos, requester);
    });

    it("obtenerTarjeta delega en ClienteTarjetaService", async () => {
      tarjeta.obtener.mockResolvedValue({ clienteId: 1, nombre: "Juan" });

      await expect(service.obtenerTarjeta(6, 1, requester)).resolves.toEqual({
        clienteId: 1,
        nombre: "Juan",
      });
      expect(tarjeta.obtener).toHaveBeenCalledWith(6, 1, requester);
    });

    it("listarPrestamosDeCliente delega en PrestamoService", async () => {
      prestamos.listarPorCliente.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.listarPrestamosDeCliente(6, 1, requester),
      ).resolves.toEqual([{ id: 1 }]);
      expect(prestamos.listarPorCliente).toHaveBeenCalledWith(6, 1, requester);
    });

    it("crearPrestamo delega en PrestamoService.crear con el requester", async () => {
      const input = {
        clienteId: 2,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      };
      const fecha = new Date("2026-09-02T00:00:00.000Z");
      prestamos.crear.mockResolvedValue({ id: 5, clienteId: 2 });

      await expect(
        service.crearPrestamo(6, input, requester, fecha),
      ).resolves.toEqual({ id: 5, clienteId: 2 });
      expect(prestamos.crear).toHaveBeenCalledWith(6, input, requester, fecha);
    });

    it("crearPrestamo usa hoy como fecha por defecto", async () => {
      const input = {
        clienteId: 2,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      };
      prestamos.crear.mockResolvedValue({ id: 5 });

      await service.crearPrestamo(6, input, requester);

      expect(prestamos.crear).toHaveBeenCalledWith(
        6,
        input,
        requester,
        expect.any(Date),
      );
    });

    it("editarCuota delega en CuotaService con el contexto auditado", async () => {
      const ctx = { password: "secreto", motivo: "corrección" };
      cuotas.editarCuota.mockResolvedValue({ id: 10 });

      await expect(
        service.editarCuota(6, 10, { valorEsperado: 500 }, ctx, requester),
      ).resolves.toEqual({ id: 10 });
      expect(cuotas.editarCuota).toHaveBeenCalledWith(
        6,
        10,
        { valorEsperado: 500 },
        ctx,
        requester,
      );
    });

    it("eliminarCuota delega en CuotaService con el contexto auditado", async () => {
      const ctx = { password: "secreto", motivo: "error" };
      cuotas.eliminarCuota.mockResolvedValue({ id: 10 });

      await expect(
        service.eliminarCuota(6, 10, ctx, requester),
      ).resolves.toEqual({ id: 10 });
      expect(cuotas.eliminarCuota).toHaveBeenCalledWith(6, 10, ctx, requester);
    });

    it("eliminarAbono delega en AbonosService con el contexto auditado", async () => {
      const ctx = { password: "secreto", motivo: "error" };
      abonos.eliminarAbono.mockResolvedValue({ id: 30 });

      await expect(
        service.eliminarAbono(6, 30, ctx, requester),
      ).resolves.toEqual({ id: 30 });
      expect(abonos.eliminarAbono).toHaveBeenCalledWith(6, 30, ctx, requester);
    });

    it("eliminarPago delega en PagosService con el contexto auditado", async () => {
      const ctx = { password: "secreto", motivo: "error" };
      pagos.eliminarPago.mockResolvedValue({ id: 40 });

      await expect(
        service.eliminarPago(6, 40, ctx, requester),
      ).resolves.toEqual({ id: 40 });
      expect(pagos.eliminarPago).toHaveBeenCalledWith(6, 40, ctx, requester);
    });

    it("registrarApertura delega en RutasAperturaService con coords y requester", async () => {
      const coords = { latitud: -17.78, longitud: -63.18 };
      aperturas.registrar.mockResolvedValue({ id: 1, rutaId: 6 });

      await expect(
        service.registrarApertura(6, coords, requester),
      ).resolves.toEqual({ id: 1, rutaId: 6 });
      expect(aperturas.registrar).toHaveBeenCalledWith(6, coords, requester, expect.any(Date));
    });

    it("registrarPosicion delega en PosicionCobradorService", async () => {
      const pos = { latitud: 5.07, longitud: -75.52 };
      posiciones.registrar.mockResolvedValue({ rutaId: 6, latitud: 5.07, longitud: -75.52 });

      await expect(
        service.registrarPosicion(6, pos, requester),
      ).resolves.toEqual({ rutaId: 6, latitud: 5.07, longitud: -75.52 });
      expect(posiciones.registrar).toHaveBeenCalledWith(6, pos, requester);
    });

    it("listarClientesDeRuta delega en ClienteService.listar con el requester", async () => {
      clientes.listar.mockResolvedValue([{ id: 1, rutaId: 6 }]);

      await expect(
        service.listarClientesDeRuta(6, requester),
      ).resolves.toEqual([{ id: 1, rutaId: 6 }]);
      expect(clientes.listar).toHaveBeenCalledWith(6, requester);
    });

    it("crearCliente delega en ClienteService.crear con evidencias y requester", async () => {
      const input = {
        nombre: "Ana",
        apellido: "Lopez",
        telefonoWhatsapp: "+59170001111",
        latitud: -17.78,
        longitud: -63.18,
      };
      const evidencias = [
        { tipo: "foto_facial" as const, archivo: {} as never },
      ];
      clientes.crear.mockResolvedValue({ id: 90 });

      await expect(
        service.crearCliente(6, input, evidencias, requester),
      ).resolves.toEqual({ id: 90 });
      expect(clientes.crear).toHaveBeenCalledWith(6, input, evidencias, requester);
    });

    it("actualizarCliente delega en ClienteService.actualizar con ubicación", async () => {
      const input = { nombre: "Ana", latitud: -17.78, longitud: -63.18 };
      clientes.actualizar.mockResolvedValue({ id: 90 });

      await expect(
        service.actualizarCliente(6, 90, input, requester),
      ).resolves.toEqual({ id: 90 });
      expect(clientes.actualizar).toHaveBeenCalledWith(6, 90, input, requester);
    });

    it("listarNotas delega en RutasNotasService.listar", async () => {
      notas.listar.mockResolvedValue([{ id: 1, nota: "n" }]);

      await expect(service.listarNotas(6, requester)).resolves.toEqual([{ id: 1, nota: "n" }]);
      expect(notas.listar).toHaveBeenCalledWith(6, requester);
    });

    it("crearNota delega en RutasNotasService.crear", async () => {
      notas.crear.mockResolvedValue({ id: 2, nota: "hola" });

      await expect(service.crearNota(6, "hola", requester)).resolves.toEqual({
        id: 2,
        nota: "hola",
      });
      expect(notas.crear).toHaveBeenCalledWith(6, { nota: "hola" }, requester);
    });

    it("obtenerEstadoCuentaPrestamo delega en EstadoCuentaService.obtener", async () => {
      const estado = { prestamoId: 200, cuotas: [{ cuotaId: 1, saldoPendiente: 50 }] };
      estadoCuenta.obtener.mockResolvedValue(estado);

      await expect(
        service.obtenerEstadoCuentaPrestamo(6, 200, requester),
      ).resolves.toEqual(estado);
      expect(estadoCuenta.obtener).toHaveBeenCalledWith(6, 200, requester);
    });

    it("obtenerDetalleCuota delega en DetalleCuotaService.obtener", async () => {
      const detalle = { cuotaId: 51, pagos: [], ultimaVisita: null };
      detalleCuota.obtener.mockResolvedValue(detalle);

      await expect(
        service.obtenerDetalleCuota(6, 200, 51, requester),
      ).resolves.toEqual(detalle);
      expect(detalleCuota.obtener).toHaveBeenCalledWith(6, 200, 51, requester);
    });

    it("generarTrayecto delega en RutaOptimizacionService.generar", async () => {
      optimizacion.generar.mockResolvedValue([[{ clienteId: 1, latitud: 5.07, longitud: -75.52 }]]);

      await expect(
        service.generarTrayecto(6, requester),
      ).resolves.toEqual([[{ clienteId: 1, latitud: 5.07, longitud: -75.52 }]]);
      expect(optimizacion.generar).toHaveBeenCalledWith(6, requester);
    });
  });
});