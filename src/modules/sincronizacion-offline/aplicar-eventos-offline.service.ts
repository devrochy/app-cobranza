import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { In, LessThan, Repository } from "typeorm";
import { RequesterOwned } from "../../common/ownership";
import { AbonosService } from "../cartera/abonos.service";
import { ClienteService } from "../cartera/cliente.service";
import { RegistrarAbonoDto } from "../cartera/dto/registrar-abono.dto";
import { RegistrarPagoDto } from "../cartera/dto/registrar-pago.dto";
import { RegistrarVisitaDto } from "../cartera/dto/registrar-visita.dto";
import { PagosService } from "../cartera/pagos.service";
import { VisitasService } from "../cartera/visitas.service";
import { CobradorPermisoNombre } from "../cobradores/cobrador-permiso.entity";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { RegistrarGastoDto } from "../rutas/dto/registrar-gasto.dto";
import { Ruta } from "../rutas/ruta.entity";
import { GastosService } from "../rutas/gastos.service";
import { Device } from "./device.entity";
import { EvidenciasOfflineService } from "./evidencias-offline.service";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";

const DTO_POR_TIPO: Record<string, new () => object> = {
  visita: RegistrarVisitaDto,
  pago: RegistrarPagoDto,
  abono: RegistrarAbonoDto,
  gasto: RegistrarGastoDto,
};

const PERMISO_POR_TIPO: Partial<Record<string, CobradorPermisoNombre>> = {
  pago: "registrar_pago",
  abono: "registrar_abono",
  gasto: "registrar_gasto",
  cambio_cliente: "actualizar_cliente",
};

const MAX_REINTENTOS = 5;

/**
 * Aplica los eventos offline aceptados (estado `pendiente`) al dominio,
 * reusando los servicios existentes. Idempotente por
 * `(dispositivo, evento_id_cliente)`; el claim atómico (pendiente/error →
 * procesando) evita duplicados entre el sync on-ingest y el job de reintentos.
 * Valida la forma del payload por tipoEvento (mismos DTOs que el flujo online)
 * y respeta la matriz cobrador_permisos del cobrador de la ruta.
 */
@Injectable()
export class AplicarEventosOfflineService {
  constructor(
    @InjectRepository(SincronizacionOffline)
    private readonly repo: Repository<SincronizacionOffline>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    private readonly visitasService: VisitasService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
    private readonly gastosService: GastosService,
    private readonly clienteService: ClienteService,
    private readonly evidenciasService: EvidenciasOfflineService,
    private readonly permisosCobrador: CobradoresPermisosService,
  ) {}

  async aplicarEventosDeDispositivo(
    device: Device,
    eventos: SincronizacionOffline[],
  ): Promise<void> {
    if (device.rutaId == null) {
      await this.marcarError(eventos, "El dispositivo no tiene ruta vinculada");
      return;
    }
    const ruta = await this.rutaRepo.findOne({ where: { id: device.rutaId } });
    if (!ruta) {
      await this.marcarError(eventos, "La ruta del dispositivo no existe");
      return;
    }
    const requester: RequesterOwned = { rol: "cobrador", sub: ruta.cobradorId };

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
        const permiso = this.permisoPorTipo(evento);
        if (permiso) {
          const tiene = await this.permisosCobrador.tienePermiso(
            ruta.cobradorId,
            permiso,
          );
          if (!tiene) {
            throw new ForbiddenException(
              `El cobrador no tiene el permiso ${permiso}`,
            );
          }
        }
        await this.validarPayload(evento.tipoEvento, evento.payloadJson);
        await this.aplicarUno(device.rutaId, evento, requester);
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

  private permisoPorTipo(evento: SincronizacionOffline): CobradorPermisoNombre | null {
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
    rutaId: number,
    evento: SincronizacionOffline,
    requester: RequesterOwned,
  ): Promise<void> {
    const payload = (evento.payloadJson ?? {}) as Record<string, unknown>;

    switch (evento.tipoEvento) {
      case "visita":
        await this.visitasService.registrar(
          rutaId,
          payload as unknown as Parameters<VisitasService["registrar"]>[1],
          requester,
        );
        return;
      case "pago":
        await this.pagosService.registrarPagoDeCuota(
          rutaId,
          payload as unknown as Parameters<PagosService["registrarPagoDeCuota"]>[1],
          requester,
        );
        return;
      case "abono":
        await this.abonosService.registrarAbono(
          rutaId,
          payload as unknown as Parameters<AbonosService["registrarAbono"]>[1],
          requester,
        );
        return;
      case "gasto": {
        const { evidencias = [], ...input } = payload;
        const archivos = await this.evidenciasService.persistir(
          evidencias as never,
        );
        await this.gastosService.registrar(rutaId, input as never, archivos, requester);
        return;
      }
      case "cambio_cliente": {
        const { clienteId, input } = payload as {
          clienteId: number;
          input: never;
        };
        await this.clienteService.actualizar(rutaId, clienteId, input, requester);
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