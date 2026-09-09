import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularDistanciaKm, ParadaGeo, PuntoInicio, segmentarTrayectos, Trayecto } from "../../domain/segmentacion-trayectos";
import { Ruta } from "./ruta.entity";
import { PosicionCobrador } from "./posicion-cobrador.entity";
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
    @InjectRepository(PosicionCobrador)
    private readonly posicionRepo: Repository<PosicionCobrador>,
  ) {}

  async generar(rutaId: number, requester: RequesterTrayectoContext): Promise<Trayecto[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const paradas = await this.obtenerClientesDelDia(rutaId);
    const inicio = await this.ubicacionDelCobrador(ruta, requester);
    const trayectos = segmentarTrayectos(paradas, MAX_PARADAS_POR_TRAYECTO, inicio);

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

  /** Última posición conocida del cobrador de la ruta; sin ella, undefined. */
  private async ubicacionDelCobrador(
    ruta: Ruta,
    requester: RequesterTrayectoContext,
  ): Promise<PuntoInicio | undefined> {
    const cobradorId = ruta.cobradorId ?? (requester.rol === "cobrador" ? requester.sub : undefined);
    if (cobradorId === undefined) {
      return undefined;
    }
    const posicion = await this.posicionRepo.findOne({
      where: { cobradorId, rutaId: ruta.id },
    });
    return posicion ? { latitud: posicion.latitud, longitud: posicion.longitud } : undefined;
  }

  private async obtenerClientesDelDia(rutaId: number): Promise<ParadaGeo[]> {
    // Misma regla de "cobro HOY" que ListaClientesDelDiaService.listarClientesConEstado:
    // entra al trayecto quien tiene una cuota que VENCE HOY, una cuota en mora, o un
    // compromiso de pago prometido HOY. Además se exige coordenadas (sin ubicación no
    // hay parada válida: las distancias serían NaN).
    const hoy = this.fechaLocal(new Date());
    const filas = await this.logRepo.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("ST_Y(c.ubicacion::geometry)", "latitud")
      .addSelect("ST_X(c.ubicacion::geometry)", "longitud")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.estatus = 'vigente'")
      .leftJoin("cuotas", "cu", "cu.prestamo_id = p.id")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .andWhere("c.ubicacion IS NOT NULL")
      .groupBy("c.id")
      .having(
        "MAX(CASE WHEN cu.fecha_vencimiento = :hoy AND cu.estatus IN ('pendiente','atrasada','pagada') THEN 1 ELSE 0 END) = 1 " +
          "OR MAX(CASE WHEN cu.estatus IN ('pendiente','atrasada') AND cu.fecha_vencimiento < :hoy THEN 1 ELSE 0 END) = 1 " +
          "OR EXISTS (SELECT 1 FROM promesas_pago pr JOIN prestamos p2 ON p2.id = pr.prestamo_id " +
          "WHERE p2.cliente_id = c.id AND pr.fecha_prometida = :hoy)",
      )
      .setParameter("hoy", hoy)
      .getRawMany<{ clienteId: string; latitud: string; longitud: string }>();
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