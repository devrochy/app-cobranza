import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { In, LessThan, Repository } from "typeorm";
import { RequesterOwned } from "../../common/ownership";
import { AbonosService } from "../clientes/abonos.service";
import { ClienteService } from "../clientes/cliente.service";
import { RegistrarAbonoDto } from "../clientes/dto/registrar-abono.dto";
import { RegistrarPagoDto } from "../clientes/dto/registrar-pago.dto";
import { RegistrarVisitaDto } from "../clientes/dto/registrar-visita.dto";
import { PagosService } from "../clientes/pagos.service";
import { VisitasService } from "../clientes/visitas.service";
import { GestorPermisoNombre } from "../gestores/gestor-permiso.entity";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { RegistrarGastoDto } from "../carteras/dto/registrar-gasto.dto";
import { RegistrarTrayectoriaRealDto } from "../carteras/dto/registrar-trayectoria-real.dto";
import { Cartera } from "../carteras/cartera.entity";
import { GastosService } from "../carteras/gastos.service";
import { TrayectoriasService } from "../carteras/trayectorias.service";
import { Device } from "./device.entity";
import { EvidenciasOfflineService } from "./evidencias-offline.service";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";

const DTO_POR_TIPO: Record<string, new () => object> = {
  visita: RegistrarVisitaDto,
  pago: RegistrarPagoDto,
  abono: RegistrarAbonoDto,
  gasto: RegistrarGastoDto,
  trayectoria: RegistrarTrayectoriaRealDto,
};

const PERMISO_POR_TIPO: Partial<Record<string, GestorPermisoNombre>> = {
  pago: "registrar_pago",
  abono: "registrar_abono",
  gasto: "registrar_gasto",
  cambio_cliente: "actualizar_cliente",
  trayectoria: "generar_reporte",
};

const MAX_REINTENTOS = 5;

/**
 * Aplica los eventos offline aceptados (estado `pendiente`) al dominio,
 * reusando los servicios existentes. Idempotente por
 * `(dispositivo, evento_id_cliente)`; el claim atómico (pendiente/error →
 * procesando) evita duplicados entre el sync on-ingest y el job de reintentos.
 * Valida la forma del payload por tipoEvento (mismos DTOs que el flujo online)
 * y respeta la matriz gestor_permisos del gestor de la cartera.
 */
@Injectable()
export class AplicarEventosOfflineService {
  constructor(
    @InjectRepository(SincronizacionOffline)
    private readonly repo: Repository<SincronizacionOffline>,
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    private readonly visitasService: VisitasService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
    private readonly gastosService: GastosService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly clienteService: ClienteService,
    private readonly evidenciasService: EvidenciasOfflineService,
    private readonly permisosGestor: GestoresPermisosService,
  ) {}

  async aplicarEventosDeDispositivo(
    device: Device,
    eventos: SincronizacionOffline[],
  ): Promise<void> {
    if (device.gestorId == null) {
      await this.marcarError(eventos, "El dispositivo no tiene gestor vinculado");
      return;
    }
    const gestorId = device.gestorId;
    const requester: RequesterOwned = { rol: "gestor", sub: gestorId };

    for (const evento of eventos) {
      if (evento.estado === "sincronizado") {
        continue;
      }
      const claim = await this.repo.update(
        {
          id: evento.id,
          estado: In(["pendiente", "error"]),
          reintentos: LessThan(MAX_REINTENTOS),
        },
        { estado: "procesando" },
      );
      if (claim.affected !== 1) {
        // Otro proceso ya lo tomó o superó el límite de reintentos.
        continue;
      }
      try {
        // El evento indica su cartera activa; debe pertenecer al gestor del
        // dispositivo (permite operar todas las carteras del gestor).
        const carteraId = await this.carteraDelEvento(evento, gestorId);
        const permiso = this.permisoPorTipo(evento);
        if (permiso) {
          const tiene = await this.permisosGestor.tienePermiso(
            gestorId,
            permiso,
          );
          if (!tiene) {
            throw new ForbiddenException(
              `El gestor no tiene el permiso ${permiso}`,
            );
          }
        }
        await this.validarPayload(evento.tipoEvento, evento.payloadJson);
        await this.aplicarUno(carteraId, evento, requester);
        await this.repo.update(evento.id, {
          estado: "sincronizado",
          syncedAt: new Date(),
          errorMotivo: null,
        });
      } catch (err) {
        const motivo =
          err instanceof Error ? err.message : "No se pudo aplicar el evento";
        await this.repo.update(evento.id, { estado: "error", errorMotivo: motivo });
        await this.repo.increment({ id: evento.id }, "reintentos", 1);
      }
    }
  }

  /** Resuelve la cartera del evento y valida que sea del gestor del dispositivo. */
  private async carteraDelEvento(
    evento: SincronizacionOffline,
    gestorId: number,
  ): Promise<number> {
    const payload = (evento.payloadJson ?? {}) as Record<string, unknown>;
    const carteraId = Number(payload.carteraId);
    if (!Number.isInteger(carteraId) || carteraId <= 0) {
      throw new BadRequestException("El evento no incluye carteraId");
    }
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera || cartera.gestorId !== gestorId) {
      throw new ForbiddenException(
        "La cartera no pertenece al gestor del dispositivo",
      );
    }
    return carteraId;
  }

  async aplicarPendientesDeDispositivo(device: Device): Promise<void> {
    const eventos = await this.repo.find({
      where: {
        dispositivo: { id: device.id },
        estado: In(["pendiente", "error"]),
      },
    });
    if (eventos.length === 0) {
      return;
    }
    await this.aplicarEventosDeDispositivo(device, eventos);
  }

  private permisoPorTipo(evento: SincronizacionOffline): GestorPermisoNombre | null {
    if (evento.tipoEvento === "visita") {
      const resultado = (evento.payloadJson as { resultado?: string } | null)
        ?.resultado;
      return resultado === "no_pago" ? "registrar_no_pago" : "registrar_pago";
    }
    return PERMISO_POR_TIPO[evento.tipoEvento] ?? null;
  }

  private async validarPayload(
    tipoEvento: string,
    payloadJson: unknown,
  ): Promise<void> {
    const payload = (payloadJson ?? {}) as Record<string, unknown>;

    if (tipoEvento === "cambio_cliente") {
      if (typeof payload.clienteId !== "number") {
        throw new BadRequestException("cambio_cliente requiere clienteId");
      }
      return;
    }

    const DTO = DTO_POR_TIPO[tipoEvento];
    if (!DTO) {
      throw new BadRequestException(`tipoEvento no soportado: ${tipoEvento}`);
    }
    const instancia = plainToInstance(DTO, payload);
    const errores = await validate(instancia);
    if (errores.length > 0) {
      const detalle = errores
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("; ");
      throw new BadRequestException(`Payload inválido: ${detalle}`);
    }
  }

  private async aplicarUno(
    carteraId: number,
    evento: SincronizacionOffline,
    requester: RequesterOwned,
  ): Promise<void> {
    // `carteraId` es un campo de transporte del evento; no forma parte de los
    // payloads de dominio.
    const payload = { ...((evento.payloadJson ?? {}) as Record<string, unknown>) };
    delete payload.carteraId;

    switch (evento.tipoEvento) {
      case "visita":
        await this.visitasService.registrar(
          carteraId,
          payload as unknown as Parameters<VisitasService["registrar"]>[1],
          requester,
        );
        return;
      case "pago":
        await this.pagosService.registrarPagoDeCuota(
          carteraId,
          payload as unknown as Parameters<PagosService["registrarPagoDeCuota"]>[1],
          requester,
        );
        return;
      case "abono":
        await this.abonosService.registrarAbono(
          carteraId,
          payload as unknown as Parameters<AbonosService["registrarAbono"]>[1],
          requester,
        );
        return;
      case "gasto": {
        const { evidencias = [], ...input } = payload;
        const archivos = await this.evidenciasService.persistir(
          evidencias as never,
        );
        await this.gastosService.registrar(carteraId, input as never, archivos, requester);
        return;
      }
      case "cambio_cliente": {
        const { clienteId, input } = payload as {
          clienteId: number;
          input: never;
        };
        await this.clienteService.actualizar(carteraId, clienteId, input, requester);
        return;
      }
      case "trayectoria": {
        const { puntos } = payload as { puntos: { latitud: number; longitud: number }[] };
        await this.trayectoriasService.registrarReal(carteraId, puntos, requester);
        return;
      }
      default:
        throw new BadRequestException(`tipoEvento no soportado: ${evento.tipoEvento}`);
    }
  }

  private async marcarError(eventos: SincronizacionOffline[], motivo: string): Promise<void> {
    for (const evento of eventos) {
      if (evento.estado === "sincronizado") {
        continue;
      }
      await this.repo.update(evento.id, { estado: "error", errorMotivo: motivo });
    }
  }
}