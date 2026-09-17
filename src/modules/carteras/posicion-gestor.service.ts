import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { assertOwned, RequesterOwned } from "../../common/ownership";
import { Cartera } from "./cartera.entity";
import { PosicionGestor } from "./posicion-gestor.entity";

export interface PosicionPublic {
  gestorId: number;
  gestorNombre: string;
  carteraId: number;
  carteraNombre: string;
  latitud: number;
  longitud: number;
  registradaEn: Date;
}

export interface EstadoCarteraEnVivoPublic {
  carteraId: number;
  carteraNombre: string;
  aperturaHoy: { fecha: string; horaInicio: string | null; latitud: number | null; longitud: number | null } | null;
  visitasHoy: number;
  cobradoHoy: number;
}

/**
 * HU-44 (MVP por polling): registra la última posición del gestor en su cartera
 * (la APK la envía periódicamente) y expone las posiciones al panel junto con
 * el estado de la cartera en vivo (apertura, visitas y cobrado de hoy).
 */
@Injectable()
export class PosicionGestorService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(PosicionGestor)
    private readonly posicionRepo: Repository<PosicionGestor>,
  ) {}

  async registrar(
    carteraId: number,
    input: { latitud: number; longitud: number },
    requester: RequesterOwned,
  ): Promise<PosicionPublic> {
    const cartera = await this.carteraRepo.findOne({
      where: { id: carteraId },
      relations: { gestor: true },
    });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    // La posición se guarda bajo el gestor real de la cartera (cartera.gestor),
    // no bajo requester.sub: la APK también la envía cuando entra como propietario y
    // requester.sub sería el id del propietario (FK a gestores(id) → 500).
    const gestorId = cartera.gestor?.id;
    if (gestorId === undefined) {
      // Sin gestor asignado no hay a quién registrar la posición.
      return {
        gestorId: requester.sub,
        gestorNombre: "",
        carteraId,
        carteraNombre: cartera.nombre,
        latitud: input.latitud,
        longitud: input.longitud,
        registradaEn: new Date(),
      };
    }

    // Upsert de la última posición por (gestor, cartera).
    const existente = await this.posicionRepo.findOne({
      where: { gestorId, carteraId },
    });
    const posicion =
      existente ??
      this.posicionRepo.create({
        gestor: { id: gestorId } as PosicionGestor["gestor"],
        gestorId,
        cartera: { id: carteraId } as PosicionGestor["cartera"],
        carteraId,
        latitud: input.latitud,
        longitud: input.longitud,
      });
    if (existente) {
      existente.latitud = input.latitud;
      existente.longitud = input.longitud;
      existente.registradaEn = new Date();
    }
    const saved = await this.posicionRepo.save(posicion);

    return {
      gestorId,
      gestorNombre: cartera.gestor ? `${cartera.gestor.nombre} ${cartera.gestor.apellido}`.trim() : "",
      carteraId,
      carteraNombre: cartera.nombre,
      latitud: saved.latitud,
      longitud: saved.longitud,
      registradaEn: saved.registradaEn,
    };
  }

  /** Últimas posiciones de los gestores del propietario (para el mapa en vivo del panel). */
  async ultimasDelPropietario(
    propietarioId: number,
    requester: RequesterOwned,
  ): Promise<PosicionPublic[]> {
    // Solo el propietario ve las posiciones de sus carteras/gestores; admin ve todas.
    const carteras = await this.carteraRepo.find({
      where: requester.rol === "propietario" ? { propietarioId } : {},
      relations: { gestor: true },
    });
    if (carteras.length === 0) {
      return [];
    }
    const posiciones = await this.posicionRepo.find({
      where: { cartera: { id: In(carteras.map((r) => r.id)) } },
      relations: { cartera: { gestor: true } },
    });
    const carteraPorId = new Map(carteras.map((r) => [r.id, r]));
    return posiciones.map((p) => {
      const cartera = carteraPorId.get(p.carteraId) ?? p.cartera;
      const gestor = cartera.gestor;
      return {
        gestorId: p.gestorId,
        gestorNombre: gestor ? `${gestor.nombre} ${gestor.apellido}`.trim() : "",
        carteraId: p.carteraId,
        carteraNombre: cartera.nombre,
        latitud: p.latitud,
        longitud: p.longitud,
        registradaEn: p.registradaEn,
      };
    });
  }
}