import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { assertOwned, RequesterOwned } from "../../common/ownership";
import { Ruta } from "./ruta.entity";
import { PosicionCobrador } from "./posicion-cobrador.entity";

export interface PosicionPublic {
  cobradorId: number;
  cobradorNombre: string;
  rutaId: number;
  rutaNombre: string;
  latitud: number;
  longitud: number;
  registradaEn: Date;
}

export interface EstadoRutaEnVivoPublic {
  rutaId: number;
  rutaNombre: string;
  aperturaHoy: { fecha: string; horaInicio: string | null; latitud: number | null; longitud: number | null } | null;
  visitasHoy: number;
  cobradoHoy: number;
}

/**
 * HU-44 (MVP por polling): registra la última posición del cobrador en su ruta
 * (la APK la envía periódicamente) y expone las posiciones al panel junto con
 * el estado de la ruta en vivo (apertura, visitas y cobrado de hoy).
 */
@Injectable()
export class PosicionCobradorService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(PosicionCobrador)
    private readonly posicionRepo: Repository<PosicionCobrador>,
  ) {}

  async registrar(
    rutaId: number,
    input: { latitud: number; longitud: number },
    requester: RequesterOwned,
  ): Promise<PosicionPublic> {
    const ruta = await this.rutaRepo.findOne({
      where: { id: rutaId },
      relations: { cobrador: true },
    });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    // Upsert de la última posición por (cobrador, ruta).
    const existente = await this.posicionRepo.findOne({
      where: { cobradorId: requester.sub, rutaId },
    });
    const posicion =
      existente ??
      this.posicionRepo.create({
        cobrador: { id: requester.sub } as PosicionCobrador["cobrador"],
        cobradorId: requester.sub,
        ruta: { id: rutaId } as PosicionCobrador["ruta"],
        rutaId,
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
      cobradorId: requester.sub,
      cobradorNombre: ruta.cobrador ? `${ruta.cobrador.nombre} ${ruta.cobrador.apellido}`.trim() : "",
      rutaId,
      rutaNombre: ruta.nombre,
      latitud: saved.latitud,
      longitud: saved.longitud,
      registradaEn: saved.registradaEn,
    };
  }

  /** Últimas posiciones de los cobradores del socio (para el mapa en vivo del panel). */
  async ultimasDelSocio(
    socioId: number,
    requester: RequesterOwned,
  ): Promise<PosicionPublic[]> {
    // Solo el socio ve las posiciones de sus rutas/cobradores; admin ve todas.
    const rutas = await this.rutaRepo.find({
      where: requester.rol === "socio" ? { socioId } : {},
      relations: { cobrador: true },
    });
    if (rutas.length === 0) {
      return [];
    }
    const posiciones = await this.posicionRepo.find({
      where: { ruta: { id: In(rutas.map((r) => r.id)) } },
      relations: { ruta: { cobrador: true } },
    });
    const rutaPorId = new Map(rutas.map((r) => [r.id, r]));
    return posiciones.map((p) => {
      const ruta = rutaPorId.get(p.rutaId) ?? p.ruta;
      const cobrador = ruta.cobrador;
      return {
        cobradorId: p.cobradorId,
        cobradorNombre: cobrador ? `${cobrador.nombre} ${cobrador.apellido}`.trim() : "",
        rutaId: p.rutaId,
        rutaNombre: ruta.nombre,
        latitud: p.latitud,
        longitud: p.longitud,
        registradaEn: p.registradaEn,
      };
    });
  }
}