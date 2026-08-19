import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularDistanciaKm, ParadaGeo, segmentarTrayectos, Trayecto } from "../../domain/segmentacion-trayectos";
import { Ruta } from "./ruta.entity";
import { RutaOptimizadaLog, TipoTrayecto } from "./ruta-optimizada-log.entity";

export const MAX_PARADAS_POR_TRAYECTO = 9;
const VELOCIDAD_MEDIA_KMH = 20;

export interface RequesterTrayectoContext {
  rol: RolUsuario;
  sub: number;
}

export interface TrayectoPublic {
  id: number;
  rutaId: number;
  fecha: string;
  ordenClientes: Trayecto[];
  waypoints: Array<{ latitud: number; longitud: number }>;
  distanciaEstimadaKm: number;
  tiempoEstimadoMin: number;
  tipo: TipoTrayecto;
}

@Injectable()
export class RutaOptimizacionService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaOptimizadaLog)
    private readonly logRepo: Repository<RutaOptimizadaLog>,
  ) {}

  async generar(rutaId: number, requester: RequesterTrayectoContext): Promise<Trayecto[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const paradas = await this.obtenerClientesDelDia(rutaId);
    const trayectos = segmentarTrayectos(paradas, MAX_PARADAS_POR_TRAYECTO);

    const log = this.logRepo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      reporteDiarioId: null,
      fecha: this.fechaLocal(new Date()),
      ordenClientesJson: trayectos,
      waypointsGeojson: trayectos,
      distanciaEstimadaKm: this.distanciaTotal(trayectos),
      tiempoEstimadoMin: Math.round((this.distanciaTotal(trayectos) / VELOCIDAD_MEDIA_KMH) * 60),
      recalculado: false,
      motivoRecalculo: null,
      tipo: "planificada",
    });
    await this.logRepo.save(log);
    return trayectos;
  }

  async consultar(rutaId: number, requester: RequesterTrayectoContext): Promise<TrayectoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const log = await this.logRepo.findOne({
      where: { ruta: { id: rutaId }, tipo: "planificada" },
      order: { fecha: "DESC", id: "DESC" },
    });
    if (!log) {
      throw new NotFoundException("No hay trayecto planificado para esta ruta");
    }
    return {
      id: log.id,
      rutaId: log.rutaId,
      fecha: log.fecha,
      ordenClientes: (log.ordenClientesJson as Trayecto[]) ?? [],
      waypoints: ((log.waypointsGeojson as Trayecto[]) ?? []).flat().map((p) => ({
        latitud: p.latitud,
        longitud: p.longitud,
      })),
      distanciaEstimadaKm: Number(log.distanciaEstimadaKm),
      tiempoEstimadoMin: log.tiempoEstimadoMin,
      tipo: log.tipo,
    };
  }

  private distanciaTotal(trayectos: Trayecto[]): number {
    let total = 0;
    for (const trayecto of trayectos) {
      for (let i = 0; i < trayecto.length - 1; i++) {
        total += calcularDistanciaKm(
          trayecto[i].latitud,
          trayecto[i].longitud,
          trayecto[i + 1].latitud,
          trayecto[i + 1].longitud,
        );
      }
    }
    return Math.round(total * 100) / 100;
  }

  private async obtenerClientesDelDia(rutaId: number): Promise<ParadaGeo[]> {
    const filas = await this.logRepo.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("ST_Y(c.ubicacion::geometry)", "latitud")
      .addSelect("ST_X(c.ubicacion::geometry)", "longitud")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id")
      .innerJoin("cuotas", "cu", "cu.prestamo_id = p.id")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = :clienteActivo", { clienteActivo: "activo" })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("cu.estatus IN (:...estatus)", { estatus: ["pendiente", "atrasada"] })
      .groupBy("c.id")
      .getRawMany<{ clienteId: number; latitud: string; longitud: string }>();
    return filas.map((f) => ({
      clienteId: Number(f.clienteId),
      latitud: Number(f.latitud),
      longitud: Number(f.longitud),
    }));
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}