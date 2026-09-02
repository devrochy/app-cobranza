import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned, RequesterOwned } from "../../common/ownership";
import { Ruta } from "./ruta.entity";
import { RutaApertura } from "./ruta-apertura.entity";

export interface RegistrarAperturaInput {
  latitud?: number;
  longitud?: number;
}

export interface AperturaPublic {
  id: number;
  rutaId: number;
  fecha: string;
  horaInicio: string | null;
  latitud: number | null;
  longitud: number | null;
}

/**
 * Registra la apertura de la ruta del día (HU-41): fecha, hora de inicio y
 * coordenadas del cobrador al abrir el día. Para auditoría de operación.
 */
@Injectable()
export class RutasAperturaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaApertura)
    private readonly aperturaRepo: Repository<RutaApertura>,
  ) {}

  async registrar(
    rutaId: number,
    input: RegistrarAperturaInput,
    requester: RequesterOwned,
    ahora: Date = new Date(),
  ): Promise<AperturaPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

    let apertura = await this.aperturaRepo.findOne({
      where: { ruta: { id: rutaId }, fecha },
    });
    if (apertura) {
      // Ya se abrió hoy: no duplicar, devolver la existente.
      return this.toPublic(apertura);
    }
    apertura = this.aperturaRepo.create({
      ruta: { id: rutaId },
      rutaId,
      fecha,
      horaInicio: hora,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
    });
    const saved = await this.aperturaRepo.save(apertura);
    return this.toPublic(saved);
  }

  private toPublic(apertura: RutaApertura): AperturaPublic {
    return {
      id: apertura.id,
      rutaId: apertura.rutaId,
      fecha: apertura.fecha,
      horaInicio: apertura.horaInicio,
      latitud: apertura.latitud,
      longitud: apertura.longitud,
    };
  }
}