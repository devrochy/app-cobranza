import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { AbonosService } from "../cartera/abonos.service";
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
import { TrayectoriasService } from "../rutas/trayectorias.service";
import { CobradorService } from "./cobrador.service";

describe("CobradorService", () => {
  let service: CobradorService;
  let rutaRepo: { find: jest.Mock };
  let rutaConfig: { getMatriz: jest.Mock };
  let permisos: { getMatriz: jest.Mock };
  let listaClientes: { obtener: jest.Mock };
  let optimizacion: { consultar: jest.Mock };
  let visitas: { registrar: jest.Mock };
  let prestamos: { listarPorCliente: jest.Mock; crear: jest.Mock };
  let gastos: { registrar: jest.Mock };
  let trayectorias: { registrarReal: jest.Mock };
  let tarjeta: { obtener: jest.Mock };
  let clientes: { listar: jest.Mock };
  let estadoCuenta: { obtener: jest.Mock };
  let cuotas: { editarCuota: jest.Mock; eliminarCuota: jest.Mock };
  let abonos: { eliminarAbono: jest.Mock };
  let aperturas: { registrar: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    rutaRepo = { find: jest.fn() };
    rutaConfig = { getMatriz: jest.fn() };
    permisos = { getMatriz: jest.fn() };
    listaClientes = { obtener: jest.fn() };
    optimizacion = { consultar: jest.fn() };
    visitas = { registrar: jest.fn() };
    prestamos = { listarPorCliente: jest.fn(), crear: jest.fn() };
    gastos = { registrar: jest.fn() };
    trayectorias = { registrarReal: jest.fn() };
    tarjeta = { obtener: jest.fn() };
    clientes = { listar: jest.fn() };
    estadoCuenta = { obtener: jest.fn() };
    cuotas = { editarCuota: jest.fn(), eliminarCuota: jest.fn() };
    abonos = { eliminarAbono: jest.fn() };
    aperturas = { registrar: jest.fn() };

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
        { provide: RutasAperturaService, useValue: aperturas },
      ],
    }).compile();

    service = module.get(CobradorService);
  });

  describe("misRutas", () => {
    it("devuelve array vacío si el cobrador no tiene rutas", async () => {
      rutaRepo.find.mockResolvedValue([]);

      await expect(service.misRutas(20)).resolves.toEqual([]);
      expect(rutaRepo.find).toHaveBeenCalledWith({
        where: { cobrador: { id: 20 } },
        order: { id: "ASC" },
      });
    });

    it("compone config y permisos por cada ruta del cobrador", async () => {
      rutaRepo.find.mockResolvedValue([
        { id: 6, nombre: "Ruta Centro", estatus: "activo" },
      ]);
      const config = { rutaId: 6, periodoLiquidacion: "diario" };
      rutaConfig.getMatriz.mockResolvedValue(config);
      const matriz = [{ permiso: "ver_cartera", habilitado: true }];
      permisos.getMatriz.mockResolvedValue(matriz);

      const result = await service.misRutas(20);

      expect(result).toEqual([
        {
          id: 6,
          nombre: "Ruta Centro",
          estatus: "activo",
          config,
          permisos: matriz,
        },
      ]);
      expect(rutaConfig.getMatriz).toHaveBeenCalledWith(6, {
        rol: "cobrador",
        sub: 20,
      });
      expect(permisos.getMatriz).toHaveBeenCalledWith(20);
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

    it("registrarApertura delega en RutasAperturaService con coords y requester", async () => {
      const coords = { latitud: -17.78, longitud: -63.18 };
      aperturas.registrar.mockResolvedValue({ id: 1, rutaId: 6 });

      await expect(
        service.registrarApertura(6, coords, requester),
      ).resolves.toEqual({ id: 1, rutaId: 6 });
      expect(aperturas.registrar).toHaveBeenCalledWith(6, coords, requester, expect.any(Date));
    });

    it("listarClientesDeRuta delega en ClienteService.listar con el requester", async () => {
      clientes.listar.mockResolvedValue([{ id: 1, rutaId: 6 }]);

      await expect(
        service.listarClientesDeRuta(6, requester),
      ).resolves.toEqual([{ id: 1, rutaId: 6 }]);
      expect(clientes.listar).toHaveBeenCalledWith(6, requester);
    });

    it("obtenerEstadoCuentaPrestamo delega en EstadoCuentaService.obtener", async () => {
      const estado = { prestamoId: 200, cuotas: [{ cuotaId: 1, saldoPendiente: 50 }] };
      estadoCuenta.obtener.mockResolvedValue(estado);

      await expect(
        service.obtenerEstadoCuentaPrestamo(6, 200, requester),
      ).resolves.toEqual(estado);
      expect(estadoCuenta.obtener).toHaveBeenCalledWith(6, 200, requester);
    });
  });
});