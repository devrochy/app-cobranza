import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Device } from "./device.entity";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";

export const TIPO_EVENTO_SYNC = [
  "visita",
  "pago",
  "abono",
  "gasto",
  "promesa_pago",
  "cambio_cliente",
] as const;

export interface EventoSincronizacionInput {
  eventoIdCliente: string;
  tipoEvento: string;
  payload: unknown;
}

export type ResultadoEventoSyncEstado = "sincronizado" | "duplicado" | "error";

export interface ResultadoEventoSync {
  eventoIdCliente: string;
  estado: ResultadoEventoSyncEstado;
  error?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ingestión de eventos offline (HU-64). Deduplica idempotentemente por
 * `(dispositivo, evento_id_cliente)` y registra cada evento en
 * `sincronizacion_offline` (estado `sincronizado`). En el MVP los eventos se
 * registran pero NO se aplican al dominio (Fase 2).
 */
@Injectable()
export class SincronizacionOfflineService {
  constructor(
    @InjectRepository(SincronizacionOffline)
    private readonly repo: Repository<SincronizacionOffline>,
  ) {}

  async ingestir(
    device: Device,
    eventos: EventoSincronizacionInput[],
  ): Promise<ResultadoEventoSync[]> {
    const resultados: ResultadoEventoSync[] = [];
    for (const evento of eventos) {
      const invalido = this.validarForma(evento);
      if (invalido) {
        resultados.push({ eventoIdCliente: evento.eventoIdCliente, estado: "error", error: invalido });
        continue;
      }

      const existente = await this.repo.findOne({
        where: { dispositivo: { id: device.id }, eventoIdCliente: evento.eventoIdCliente },
      });
      if (existente) {
        resultados.push({ eventoIdCliente: evento.eventoIdCliente, estado: "duplicado" });
        continue;
      }

      try {
        await this.repo.save(
          this.repo.create({
            dispositivo: { id: device.id } as Device,
            dispositivoId: device.id,
            eventoIdCliente: evento.eventoIdCliente,
            tipoEvento: evento.tipoEvento,
            payloadJson: evento.payload ?? null,
            estado: "sincronizado",
            syncedAt: new Date(),
          }),
        );
        resultados.push({ eventoIdCliente: evento.eventoIdCliente, estado: "sincronizado" });
      } catch (err) {
        // Carrera contra la constraint única: otro lote ya lo registró.
        if (this.isUniqueViolation(err)) {
          resultados.push({ eventoIdCliente: evento.eventoIdCliente, estado: "duplicado" });
        } else {
          resultados.push({
            eventoIdCliente: evento.eventoIdCliente,
            estado: "error",
            error: "No se pudo registrar el evento",
          });
        }
      }
    }
    return resultados;
  }

  private validarForma(evento: EventoSincronizacionInput): string | null {
    if (!UUID_REGEX.test(evento.eventoIdCliente)) {
      return "eventoIdCliente debe ser un uuid válido";
    }
    if (!(TIPO_EVENTO_SYNC as readonly string[]).includes(evento.tipoEvento)) {
      return "tipoEvento no está en el catálogo";
    }
    return null;
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }
}