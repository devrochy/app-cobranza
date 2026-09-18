import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { AbonosService } from "../clientes/abonos.service";
import { PagosService } from "../clientes/pagos.service";
import { LiquidacionesService } from "../carteras/liquidaciones.service";
import { ClienteTarjetaService } from "../clientes/cliente-tarjeta.service";
import { ClienteService } from "../clientes/cliente.service";
import { EstadoCuentaService } from "../clientes/estado-cuenta.service";
import { CuotaService } from "../clientes/cuota.service";
import { PrestamoService } from "../clientes/prestamo.service";
import { CarterasAperturaService } from "../carteras/carteras-apertura.service";
import { VisitasService } from "../clientes/visitas.service";
import { Cartera } from "../carteras/cartera.entity";
import { CarteraConfigService } from "../carteras/cartera-config.service";
import { GastosService } from "../carteras/gastos.service";
import { ListaClientesDelDiaService } from "../carteras/lista-clientes-dia.service";
import { CarteraOptimizacionService } from "../carteras/cartera-optimizacion.service";
import { PosicionGestorService } from "../carteras/posicion-gestor.service";
import { DetalleCuotaService } from "../clientes/detalle-cuota.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { CarterasNotasService } from "../carteras/carteras-notas.service";
import { CarterasService } from "../carteras/carteras.service";
import { TrayectoriasService } from "../carteras/trayectorias.service";
import { GestorService } from "./gestor.service";

describe("GestorService", () => {
  let service: GestorService;
  let carteraRepo: { find: jest.Mock };
  let carteraConfig: { getMatriz: jest.Mock };
  let permisos: { getMatriz: jest.Mock };
  let listaClientes: { obtener: jest.Mock };
  let optimizacion: { consultar: jest.Mock; generar: jest.Mock };
  let visitas: { registrar: jest.Mock };
  let prestamos: { listarPorCliente: jest.Mock; crear: jest.Mock };
  let gastos: { registrar: jest.Mock };
  let trayectorias: { registrarReal: jest.Mock };
  let tarjeta: { obtener: jest.Mock };
  let clientes: { listar: jest.Mock; listarConEstado: jest.Mock; crear: jest.Mock; actualizar: jest.Mock };
  let estadoCuenta: { obtener: jest.Mock };
  let cuotas: { editarCuota: jest.Mock; eliminarCuota: jest.Mock };
  let abonos: { eliminarAbono: jest.Mock };
  let pagos: { eliminarPago: jest.Mock };
  let liquidaciones: { generar: jest.Mock; listar: jest.Mock; exportarPdf: jest.Mock };
  let aperturas: { registrar: jest.Mock };
  let posiciones: { registrar: jest.Mock };
  let detalleCuota: { obtener: jest.Mock };
  let permisosPropietario: { getMatriz: jest.Mock; tienePermiso: jest.Mock };
  let notas: { listar: jest.Mock; crear: jest.Mock };
  let carteras: { actualizarInformacion: jest.Mock; actualizarConfiguracion: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    carteraRepo = { find: jest.fn() };
    carteraConfig = { getMatriz: jest.fn() };
    permisos = { getMatriz: jest.fn() };
    listaClientes = { obtener: jest.fn() };
    optimizacion = { consultar: jest.fn(), generar: jest.fn() };
    visitas = { registrar: jest.fn() };
    prestamos = { listarPorCliente: jest.fn(), crear: jest.fn() };
    gastos = { registrar: jest.fn() };
    trayectorias = { registrarReal: jest.fn() };
    tarjeta = { obtener: jest.fn() };
    clientes = { listar: jest.fn(), listarConEstado: jest.fn(), crear: jest.fn(), actualizar: jest.fn() };
    estadoCuenta = { obtener: jest.fn() };
    cuotas = { editarCuota: jest.fn(), eliminarCuota: jest.fn() };
    abonos = { eliminarAbono: jest.fn() };
    pagos = { eliminarPago: jest.fn() };
    liquidaciones = { generar: jest.fn(), listar: jest.fn(), exportarPdf: jest.fn() };
    aperturas = { registrar: jest.fn() };
    posiciones = { registrar: jest.fn() };
    detalleCuota = { obtener: jest.fn() };
    permisosPropietario = { getMatriz: jest.fn(), tienePermiso: jest.fn() };
    notas = { listar: jest.fn(), crear: jest.fn() };
    carteras = { actualizarInformacion: jest.fn(), actualizarConfiguracion: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestorService,
        { provide: getRepositoryToken(Cartera), useValue: carteraRepo },
        { provide: CarteraConfigService, useValue: carteraConfig },
        { provide: GestoresPermisosService, useValue: permisos },
        { provide: ListaClientesDelDiaService, useValue: listaClientes },
        { provide: CarteraOptimizacionService, useValue: optimizacion },
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
        { provide: LiquidacionesService, useValue: liquidaciones },
        { provide: CarterasAperturaService, useValue: aperturas },
        { provide: PosicionGestorService, useValue: posiciones },
        { provide: DetalleCuotaService, useValue: detalleCuota },
        { provide: PermisosPropietarioService, useValue: permisosPropietario },
        { provide: CarterasService, useValue: carteras },
        { provide: CarterasNotasService, useValue: notas },
      ],
    }).compile();

    service = module.get(GestorService);
  });

  describe("misCarteras", () => {
    const requester = { rol: "gestor" as const, sub: 20 };

    it("devuelve array vacío si el gestor no tiene carteras", async () => {
      carteraRepo.find.mockResolvedValue([]);

      await expect(service.misCarteras(requester)).resolves.toEqual([]);
      expect(carteraRepo.find).toHaveBeenCalledWith({
        where: { gestor: { id: 20 } },
        order: { id: "ASC" },
      });
    });

    it("compone config y permisos por cada cartera del gestor", async () => {
      carteraRepo.find.mockResolvedValue([
        { id: 6, nombre: "Cartera Centro", estatus: "activo", tipoInteres: 20, numCuotas: 8 },
      ]);
      const config = { carteraId: 6, periodoLiquidacion: "diario" };
      carteraConfig.getMatriz.mockResolvedValue(config);
      const matriz = [{ permiso: "ver_cartera", habilitado: true }];
      permisos.getMatriz.mockResolvedValue(matriz);

      const result = await service.misCarteras(requester);

      expect(result).toEqual([
        {
          id: 6,
          nombre: "Cartera Centro",
          estatus: "activo",
          tipoInteres: 20,
          numCuotas: 8,
          config,
          permisos: matriz,
        },
      ]);
      expect(carteraConfig.getMatriz).toHaveBeenCalledWith(6, requester);
      expect(permisos.getMatriz).toHaveBeenCalledWith(20);
    });

    it("para un propietario filtra por propietarioId y mapea sus permisos a nombres de gestor", async () => {
      const propietarioRequester = { rol: "propietario" as const, sub: 3 };
      carteraRepo.find.mockResolvedValue([
        { id: 9, nombre: "Cartera Norte", estatus: "activo", tipoInteres: 15, numCuotas: 6 },
      ]);
      carteraConfig.getMatriz.mockResolvedValue({ carteraId: 9, periodoLiquidacion: "diario" });
      permisosPropietario.getMatriz.mockResolvedValue([
        { permiso: "ver_reportes", habilitado: true },
        { permiso: "configurar_cartera", habilitado: false },
      ]);

      const result = await service.misCarteras(propietarioRequester);

      expect(carteraRepo.find).toHaveBeenCalledWith({
        where: { propietario: { id: 3 } },
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
      const requester = { rol: "gestor" as const, sub: 20 };
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
      const requester = { rol: "gestor" as const, sub: 20 };
      listaClientes.obtener.mockResolvedValue([]);
      optimizacion.consultar.mockRejectedValue(new NotFoundException());

      const result = await service.dia(6, requester);

      expect(result.clientes).toEqual([]);
      expect(result.trayectos).toBeNull();
    });
  });

  describe("operaciones (delegación a servicios de dominio)", () => {
    const requester = { rol: "gestor" as const, sub: 20 };

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

    it("generarLiquidacion delega en LiquidacionesService", async () => {
      liquidaciones.generar.mockResolvedValue({ id: 1 });

      const res = await service.generarLiquidacion(6, { comentario: "cierre" }, requester);

      expect(liquidaciones.generar).toHaveBeenCalledWith(6, { comentario: "cierre" }, requester);
      expect(res).toEqual({ id: 1 });
    });

    it("listarLiquidaciones delega en LiquidacionesService", async () => {
      liquidaciones.listar.mockResolvedValue([]);

      await service.listarLiquidaciones(6, requester);

      expect(liquidaciones.listar).toHaveBeenCalledWith(6, requester);
    });

    it("exportarLiquidacionPdf delega en LiquidacionesService", async () => {
      liquidaciones.exportarPdf.mockResolvedValue({ buffer: Buffer.from("%PDF-"), filename: "l.pdf" });

      const res = await service.exportarLiquidacionPdf(6, 1, requester);

      expect(liquidaciones.exportarPdf).toHaveBeenCalledWith(6, 1, requester);
      expect(res.filename).toBe("l.pdf");
    });

    it("registrarApertura delega en CarterasAperturaService con coords y requester", async () => {
      const coords = { latitud: -17.78, longitud: -63.18 };
      aperturas.registrar.mockResolvedValue({ id: 1, carteraId: 6 });

      await expect(
        service.registrarApertura(6, coords, requester),
      ).resolves.toEqual({ id: 1, carteraId: 6 });
      expect(aperturas.registrar).toHaveBeenCalledWith(6, coords, requester, expect.any(Date));
    });

    it("registrarPosicion delega en PosicionGestorService", async () => {
      const pos = { latitud: 5.07, longitud: -75.52 };
      posiciones.registrar.mockResolvedValue({ carteraId: 6, latitud: 5.07, longitud: -75.52 });

      await expect(
        service.registrarPosicion(6, pos, requester),
      ).resolves.toEqual({ carteraId: 6, latitud: 5.07, longitud: -75.52 });
      expect(posiciones.registrar).toHaveBeenCalledWith(6, pos, requester);
    });

    it("listarClientesDeCartera delega en ClienteService.listarConEstado con el requester", async () => {
      clientes.listarConEstado.mockResolvedValue([{ id: 1, carteraId: 6 }]);

      await expect(
        service.listarClientesDeCartera(6, requester),
      ).resolves.toEqual([{ id: 1, carteraId: 6 }]);
      expect(clientes.listarConEstado).toHaveBeenCalledWith(6, requester);
    });

    it("crearCliente delega en ClienteService.crear con evidencias y requester", async () => {
      const input = {
        nombre: "Ana",
        apellido: "Lopez",
        telefonoWhatsapp: "+59170001111",
        latitud: -17.78,
        longitud: -63.18,
        tipoDocumento: "ci" as const,
        numeroDocumento: "1234567",
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

    it("listarNotas delega en CarterasNotasService.listar", async () => {
      notas.listar.mockResolvedValue([{ id: 1, nota: "n" }]);

      await expect(service.listarNotas(6, requester)).resolves.toEqual([{ id: 1, nota: "n" }]);
      expect(notas.listar).toHaveBeenCalledWith(6, requester);
    });

    it("crearNota delega en CarterasNotasService.crear", async () => {
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

    it("generarTrayecto delega en CarteraOptimizacionService.generar", async () => {
      optimizacion.generar.mockResolvedValue([[{ clienteId: 1, latitud: 5.07, longitud: -75.52 }]]);

      await expect(
        service.generarTrayecto(6, requester),
      ).resolves.toEqual([[{ clienteId: 1, latitud: 5.07, longitud: -75.52 }]]);
      expect(optimizacion.generar).toHaveBeenCalledWith(6, requester);
    });

    it("actualizarCartera delega en CarterasService.actualizarInformacion", async () => {
      carteras.actualizarInformacion.mockResolvedValue({ id: 6 });

      await service.actualizarCartera(6, { nombre: "Nueva" }, requester);

      expect(carteras.actualizarInformacion).toHaveBeenCalledWith(6, { nombre: "Nueva" }, requester);
    });

    it("actualizarConfiguracionCartera delega en CarterasService.actualizarConfiguracion", async () => {
      carteras.actualizarConfiguracion.mockResolvedValue({ id: 6 });

      await service.actualizarConfiguracionCartera(6, { tipoInteres: 10 }, requester);

      expect(carteras.actualizarConfiguracion).toHaveBeenCalledWith(6, { tipoInteres: 10 }, requester);
    });
  });
});