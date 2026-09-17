import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned, RequesterOwned } from "../../common/ownership";
import { Cartera } from "./cartera.entity";
import { CarteraApertura } from "./cartera-apertura.entity";

export interface RegistrarAperturaInput {
  latitud?: number;
  longitud?: number;
}

export interface AperturaPublic {
  id: number;
  carteraId: number;
  fecha: string;
  horaInicio: string | null;
  latitud: number | null;
  longitud: number | null;
}

/**
 * Registra la apertura de la cartera del día (HU-41): fecha, hora de inicio y
 * coordenadas del gestor al abrir el día. Para auditoría de operación.
 */
@Injectable()
export class CarterasAperturaService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraApertura)
    private readonly aperturaRepo: Repository<CarteraApertura>,
  ) {}

  async registrar(
    carteraId: number,
    input: RegistrarAperturaInput,
    requester: RequesterOwned,
    ahora: Date = new Date(),
  ): Promise<AperturaPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

    let apertura = await this.aperturaRepo.findOne({
      where: { cartera: { id: carteraId }, fecha },
    });
    if (apertura) {
      // Ya se abrió hoy: no duplicar, devolver la existente.
      return this.toPublic(apertura);
    }
    apertura = this.aperturaRepo.create({
      cartera: { id: carteraId },
      carteraId,
      fecha,
      horaInicio: hora,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
    });
    const saved = await this.aperturaRepo.save(apertura);
    return this.toPublic(saved);
  }

  private toPublic(apertura: CarteraApertura): AperturaPublic {
    return {
      id: apertura.id,
      carteraId: apertura.carteraId,
      fecha: apertura.fecha,
      horaInicio: apertura.horaInicio,
      latitud: apertura.latitud,
      longitud: apertura.longitud,
    };
  }
}