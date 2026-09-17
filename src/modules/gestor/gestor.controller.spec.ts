import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { AuthTokenPayload } from "../auth/auth.service";
import { GestorPermisoGuard } from "../auth/gestor-permiso.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { RegistrarVisitaDto } from "../clientes/dto/registrar-visita.dto";
import { EditarCuotaDto } from "../clientes/dto/editar-cuota.dto";
import { EstadisticasCarteraService } from "../carteras/estadisticas-cartera.service";
import { GestorService } from "./gestor.service";
import { GestorController } from "./gestor.controller";

describe("GestorController", () => {
  let controller: GestorController;
  let service: GestorService;

  const mockService = {
    misCarteras: jest.fn(),
    dia: jest.fn(),
    registrarVisita: jest.fn(),
    registrarGasto: jest.fn(),
    registrarTrayectoriaReal: jest.fn(),
    obtenerTarjeta: jest.fn(),
    listarPrestamosDeCliente: jest.fn(),
    crearPrestamo: jest.fn(),
    editarCuota: jest.fn(),
    eliminarCuota: jest.fn(),
    eliminarAbono: jest.fn(),
    registrarApertura: jest.fn(),
    crearCliente: jest.fn(),
    actualizarCliente: jest.fn(),
    listarNotas: jest.fn(),
    crearNota: jest.fn(),
  };

  const mockEstadisticasCarteraService = {
    obtener: jest.fn(),
  };

  function req(sub = 20): Request & { user: AuthTokenPayload } {
    return {
      user: { sub, rol: "gestor", tipo: "access", usuario: "gestor1" },
    } as Request & { user: AuthTokenPayload };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GestorController],
      providers: [
        { provide: GestorService, useValue: mockService },
        { provide: EstadisticasCarteraService, useValue: mockEstadisticasCarteraService },
        JwtAuthGuard,
        GestorPermisoGuard,
        { provide: JwtService, useValue: new JwtService() },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: DataSource, useValue: {} },
        Reflector,
        { provide: GestoresPermisosService, useValue: { tienePermiso: jest.fn() } },
        { provide: PermisosPropietarioService, useValue: { tienePermiso: jest.fn() } },
      ],
    }).compile();

    controller = module.get(GestorController);
    service = module.get(GestorService);
  });

  it("misCarteras delega con el requester del token", async () => {
    mockService.misCarteras.mockResolvedValue([]);

    await expect(controller.misCarteras(req())).resolves.toEqual([]);
    expect(service.misCarteras).toHaveBeenCalledWith({ rol: "gestor", sub: 20 });
  });

  it("dia delega con la cartera y el requester del token", async () => {
    mockService.dia.mockResolvedValue({ clientes: [], trayectos: null });

    await expect(controller.dia(6, req())).resolves.toEqual({
      clientes: [],
      trayectos: null,
    });
    expect(service.dia).toHaveBeenCalledWith(6, { rol: "gestor", sub: 20 });
  });

  it("estadisticas delega con la cartera y el requester del token", async () => {
    mockEstadisticasCarteraService.obtener.mockResolvedValue({
      carteraId: 6,
      actual: { totalClientes: 0 },
    });

    await expect(controller.estadisticas(6, req())).resolves.toEqual({
      carteraId: 6,
      actual: { totalClientes: 0 },
    });
    expect(mockEstadisticasCarteraService.obtener).toHaveBeenCalledWith(6, {
      rol: "gestor",
      sub: 20,
    });
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
    }, { rol: "gestor", sub: 20 });
  });

  it("visitas/no-pago fija resultado no_pago y delega", async () => {
    const dto: RegistrarVisitaDto = { prestamoId: 1, clienteId: 2, resultado: "pago" };
    mockService.registrarVisita.mockResolvedValue({ id: 1 });

    await expect(controller.registrarVisitaNoPago(6, dto, req())).resolves.toEqual({ id: 1 });
    expect(service.registrarVisita).toHaveBeenCalledWith(6, {
      ...dto,
      resultado: "no_pago",
    }, { rol: "gestor", sub: 20 });
  });

  it("gastos delega con archivos (o array vacío) y el requester", async () => {
    const dto = { descripcion: "Combustible", valor: 50 };
    const files = [{ originalname: "a.jpg" }] as unknown as Express.Multer.File[];
    mockService.registrarGasto.mockResolvedValue({ id: 1 });

    await expect(controller.registrarGasto(6, dto, files, req())).resolves.toEqual({ id: 1 });
    expect(service.registrarGasto).toHaveBeenCalledWith(6, dto, files, {
      rol: "gestor",
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
      rol: "gestor",
      sub: 20,
    });
  });

  it("tarjeta delega con cartera, cliente y requester", async () => {
    mockService.obtenerTarjeta.mockResolvedValue({ clienteId: 2 });

    await expect(controller.obtenerTarjeta(6, 2, req())).resolves.toEqual({ clienteId: 2 });
    expect(service.obtenerTarjeta).toHaveBeenCalledWith(6, 2, { rol: "gestor", sub: 20 });
  });

  it("listarPrestamosDeCliente delega con cartera, cliente y requester", async () => {
    mockService.listarPrestamosDeCliente.mockResolvedValue([{ id: 1 }]);

    await expect(controller.listarPrestamosDeCliente(6, 2, req())).resolves.toEqual([{ id: 1 }]);
    expect(service.listarPrestamosDeCliente).toHaveBeenCalledWith(6, 2, {
      rol: "gestor",
      sub: 20,
    });
  });

  it("crearCliente delega en crearCliente con evidencias y requester", async () => {
    const dto = {
      nombre: "Ana",
      apellido: "Lopez",
      telefonoWhatsapp: "+59170001111",
      latitud: -17.78,
      longitud: -63.18,
      tipoDocumento: "ci" as const,
      numeroDocumento: "1234567",
    };
    const archivo = { originalname: "foto.jpg", size: 1024 } as Express.Multer.File;
    mockService.crearCliente.mockResolvedValue({ id: 90 });

    await expect(
      controller.crearCliente(
        6,
        dto,
        { foto_facial: [archivo] },
        req(),
      ),
    ).resolves.toEqual({ id: 90 });
    expect(service.crearCliente).toHaveBeenCalledWith(
      6,
      dto,
      [{ tipo: "foto_facial", archivo }],
      { rol: "gestor", sub: 20 },
    );
  });

  it("crearCliente no pasa evidencias si no vienen archivos", async () => {
    mockService.crearCliente.mockResolvedValue({ id: 91 });

    await expect(controller.crearCliente(6, {} as never, {}, req())).resolves.toEqual({ id: 91 });
    expect(service.crearCliente).toHaveBeenCalledWith(6, {}, [], { rol: "gestor", sub: 20 });
  });

  it("actualizarCliente delega en actualizarCliente con DTO y requester", async () => {
    const dto = { nombre: "Ana", latitud: -17.78, longitud: -63.18 };
    mockService.actualizarCliente.mockResolvedValue({ id: 90 });

    await expect(controller.actualizarCliente(6, 90, dto, req())).resolves.toEqual({ id: 90 });
    expect(service.actualizarCliente).toHaveBeenCalledWith(6, 90, dto, {
      rol: "gestor",
      sub: 20,
    });
  });

  it("listarNotas delega con cartera y requester", async () => {
    mockService.listarNotas.mockResolvedValue([{ id: 1, nota: "n" }]);

    await expect(controller.listarNotas(6, req())).resolves.toEqual([{ id: 1, nota: "n" }]);
    expect(service.listarNotas).toHaveBeenCalledWith(6, { rol: "gestor", sub: 20 });
  });

  it("crearNota delega con la nota y el requester", async () => {
    mockService.crearNota.mockResolvedValue({ id: 2, nota: "hola" });

    await expect(controller.crearNota(6, { nota: "hola" }, req())).resolves.toEqual({
      id: 2,
      nota: "hola",
    });
    expect(service.crearNota).toHaveBeenCalledWith(6, "hola", { rol: "gestor", sub: 20 });
  });

  it("prestamos delega en crearPrestamo con fecha parseada y requester", async () => {
    const dto = {
      clienteId: 2,
      valor: 1000,
      numCuotas: 4,
      diasEntreCuotas: 7,
      fechaOtorgado: "2026-09-02",
    };
    mockService.crearPrestamo.mockResolvedValue({ id: 5 });

    await expect(controller.crearPrestamo(6, dto, req())).resolves.toEqual({ id: 5 });
    expect(service.crearPrestamo).toHaveBeenCalledWith(
      6,
      {
        clienteId: 2,
        valor: 1000,
        numCuotas: 4,
        diasEntreCuotas: 7,
      },
      { rol: "gestor", sub: 20 },
      new Date("2026-09-02"),
    );
  });

  it("cuotas PATCH delega en editarCuota con DTO auditado", async () => {
    const dto: EditarCuotaDto = {
      valorEsperado: 500,
      password: "secreto",
      motivo: "corrección",
    };
    mockService.editarCuota.mockResolvedValue({ id: 10 });

    await expect(controller.editarCuota(6, 10, dto, req())).resolves.toEqual({ id: 10 });
    expect(service.editarCuota).toHaveBeenCalledWith(
      6,
      10,
      { valorEsperado: 500 },
      { password: "secreto", motivo: "corrección" },
      { rol: "gestor", sub: 20 },
    );
  });

  it("cuotas DELETE delega en eliminarCuota con DTO auditado", async () => {
    const dto = { password: "secreto", motivo: "error" };
    mockService.eliminarCuota.mockResolvedValue({ id: 10 });

    await expect(controller.eliminarCuota(6, 10, dto, req())).resolves.toEqual({ id: 10 });
    expect(service.eliminarCuota).toHaveBeenCalledWith(
      6,
      10,
      { password: "secreto", motivo: "error" },
      { rol: "gestor", sub: 20 },
    );
  });

  it("abonos DELETE delega en eliminarAbono con DTO auditado", async () => {
    const dto = { password: "secreto", motivo: "error" };
    mockService.eliminarAbono.mockResolvedValue({ id: 30 });

    await expect(controller.eliminarAbono(6, 30, dto, req())).resolves.toEqual({ id: 30 });
    expect(service.eliminarAbono).toHaveBeenCalledWith(
      6,
      30,
      { password: "secreto", motivo: "error" },
      { rol: "gestor", sub: 20 },
    );
  });

  it("apertura delega en registrarApertura con las coordenadas y el requester", async () => {
    const dto = { latitud: -17.78, longitud: -63.18 };
    mockService.registrarApertura.mockResolvedValue({ id: 1, carteraId: 6 });

    await expect(controller.registrarApertura(6, dto, req())).resolves.toEqual({
      id: 1,
      carteraId: 6,
    });
    expect(service.registrarApertura).toHaveBeenCalledWith(
      6,
      { latitud: -17.78, longitud: -63.18 },
      { rol: "gestor", sub: 20 },
    );
  });
});