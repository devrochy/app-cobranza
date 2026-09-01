import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AbonosService } from "../cartera/abonos.service";
import { ClienteService } from "../cartera/cliente.service";
import { PagosService } from "../cartera/pagos.service";
import { VisitasService } from "../cartera/visitas.service";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { Ruta } from "../rutas/ruta.entity";
import { GastosService } from "../rutas/gastos.service";
import { Device } from "./device.entity";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { EvidenciasOfflineService } from "./evidencias-offline.service";

describe("AplicarEventosOfflineService", () => {
  let service: AplicarEventosOfflineService;
  let repo: { update: jest.Mock; increment: jest.Mock; find: jest.Mock };
  let rutaRepo: { findOne: jest.Mock };
  let visitas: { registrar: jest.Mock };
  let pagos: { registrarPagoDeCuota: jest.Mock };
  let abonos: { registrarAbono: jest.Mock };
  let gastos: { registrar: jest.Mock };
  let clienteService: { actualizar: jest.Mock };
  let evidencias: { persistir: jest.Mock };
  let permisosCobrador: { tienePermiso: jest.Mock };

  const device: Device = { id: 1, rutaId: 1779 } as Device;
  const requester = { rol: "cobrador", sub: 20 };

  function evento(overrides: Partial<SincronizacionOffline> = {}): SincronizacionOffline {
    return {
      id: 1,
      dispositivoId: 1,
      eventoIdCliente: "11111111-1111-1111-1111-111111111111",
      tipoEvento: "visita",
      payloadJson: {},
      estado: "pendiente",
      syncedAt: null,
      ...overrides,
    } as SincronizacionOffline;
  }

  const payloadVisitaValido = {
    prestamoId: 1,
    clienteId: 2,
    resultado: "pago",
    tipoPago: "cuota",
    cuotaId: 10,
    valor: 300,
    metodoPago: "efectivo",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn(),
      find: jest.fn(),
    };
    rutaRepo = { findOne: jest.fn() };
    visitas = { registrar: jest.fn() };
    pagos = { registrarPagoDeCuota: jest.fn() };
    abonos = { registrarAbono: jest.fn() };
    gastos = { registrar: jest.fn() };
    clienteService = { actualizar: jest.fn() };
    evidencias = { persistir: jest.fn() };
    permisosCobrador = { tienePermiso: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AplicarEventosOfflineService,
        { provide: getRepositoryToken(SincronizacionOffline), useValue: repo },
        { provide: getRepositoryToken(Ruta), useValue: rutaRepo },
        { provide: VisitasService, useValue: visitas },
        { provide: PagosService, useValue: pagos },
        { provide: AbonosService, useValue: abonos },
        { provide: GastosService, useValue: gastos },
        { provide: ClienteService, useValue: clienteService },
        { provide: EvidenciasOfflineService, useValue: evidencias },
        { provide: CobradoresPermisosService, useValue: permisosCobrador },
      ],
    }).compile();

    service = module.get(AplicarEventosOfflineService);
  });

  it("aplica una visita y marca el evento sincronizado", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({ tipoEvento: "visita", payloadJson: payloadVisitaValido });
    visitas.registrar.mockResolvedValue({ id: 1 });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(visitas.registrar).toHaveBeenCalledWith(1779, payloadVisitaValido, requester);
    expect(permisosCobrador.tienePermiso).toHaveBeenCalledWith(20, "registrar_pago");
    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "sincronizado",
      syncedAt: expect.any(Date),
      errorMotivo: null,
    });
  });

  it("marca error con motivo si la aplicación falla", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({ tipoEvento: "visita", payloadJson: payloadVisitaValido });
    visitas.registrar.mockRejectedValue(new BadRequestException("Cuota no existe"));

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "error",
      errorMotivo: expect.stringContaining("Cuota no existe"),
    });
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, "reintentos", 1);
  });

  it("salta eventos ya sincronizados (idempotencia)", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({ estado: "sincronizado" });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(visitas.registrar).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("no aplica un evento si otro proceso ya lo reclamó", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    (repo.update as jest.Mock).mockResolvedValue({ affected: 0 });
    const e = evento({ tipoEvento: "visita", payloadJson: payloadVisitaValido });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(visitas.registrar).not.toHaveBeenCalled();
  });

  it("marca error si el cobrador no tiene el permiso", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    permisosCobrador.tienePermiso.mockResolvedValue(false);
    const e = evento({ tipoEvento: "gasto", payloadJson: { descripcion: "x", valor: 10 } });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "error",
      errorMotivo: expect.stringContaining("registrar_gasto"),
    });
    expect(gastos.registrar).not.toHaveBeenCalled();
  });

  it("rechaza un monto negativo (payload inválido)", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({ tipoEvento: "gasto", payloadJson: { descripcion: "x", valor: -50 } });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "error",
      errorMotivo: expect.stringContaining("Payload inválido"),
    });
    expect(gastos.registrar).not.toHaveBeenCalled();
  });

  it("marca error si el dispositivo no tiene ruta vinculada", async () => {
    const sinRuta = { id: 1, rutaId: null } as Device;
    const e = evento();

    await service.aplicarEventosDeDispositivo(sinRuta, [e]);

    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "error",
      errorMotivo: expect.stringContaining("ruta"),
    });
  });

  it("persiste evidencias base64 y registra el gasto", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({
      tipoEvento: "gasto",
      payloadJson: {
        descripcion: "Combustible",
        valor: 50,
        evidencias: [{ nombre: "a.jpg", mimetype: "image/jpeg", base64: "AAAA" }],
      },
    });
    evidencias.persistir.mockReturnValue([{ originalname: "a.jpg" }]);

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(evidencias.persistir).toHaveBeenCalledWith([
      { nombre: "a.jpg", mimetype: "image/jpeg", base64: "AAAA" },
    ]);
    expect(gastos.registrar).toHaveBeenCalledWith(
      1779,
      { descripcion: "Combustible", valor: 50 },
      [{ originalname: "a.jpg" }],
      requester,
    );
  });

  it("marca error si el tipo de evento no se puede aplicar", async () => {
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    const e = evento({ tipoEvento: "desconocido" });

    await service.aplicarEventosDeDispositivo(device, [e]);

    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "error",
      errorMotivo: expect.stringContaining("no soportado"),
    });
  });

  it("aplicarPendientesDeDispositivo procesa los eventos pendientes/error del device", async () => {
    repo.find.mockResolvedValue([
      evento({ tipoEvento: "visita", payloadJson: payloadVisitaValido }),
    ]);
    rutaRepo.findOne.mockResolvedValue({ id: 1779, cobradorId: 20 });
    visitas.registrar.mockResolvedValue({ id: 1 });

    await service.aplicarPendientesDeDispositivo(device);

    expect(visitas.registrar).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(1, {
      estado: "sincronizado",
      syncedAt: expect.any(Date),
      errorMotivo: null,
    });
  });
});