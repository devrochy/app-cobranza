import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularDistanciaKm, ParadaGeo, PuntoInicio, segmentarTrayectos, Trayecto } from "../../domain/segmentacion-trayectos";
import { Cartera } from "./cartera.entity";
import { PosicionGestor } from "./posicion-gestor.entity";
import { CarteraOptimizadaLog, TipoTrayecto } from "./cartera-optimizada-log.entity";

export const MAX_PARADAS_POR_TRAYECTO = 9;
const VELOCIDAD_MEDIA_KMH = 20;

export interface RequesterTrayectoContext {
  rol: RolUsuario;
  sub: number;
}

export interface TrayectoPublic {
  id: number;
  carteraId: number;
  fecha: string;
  ordenClientes: Trayecto[];
  waypoints: Array<{ latitud: number; longitud: number }>;
  distanciaEstimadaKm: number;
  tiempoEstimadoMin: number;
  tipo: TipoTrayecto;
}

@Injectable()
export class CarteraOptimizacionService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraOptimizadaLog)
    private readonly logRepo: Repository<CarteraOptimizadaLog>,
    @InjectRepository(PosicionGestor)
    private readonly posicionRepo: Repository<PosicionGestor>,
  ) {}

  async generar(carteraId: number, requester: RequesterTrayectoContext): Promise<Trayecto[]> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const paradas = await this.obtenerClientesDelDia(carteraId);
    const inicio = await this.ubicacionDelGestor(cartera, requester);
    const trayectos = segmentarTrayectos(paradas, MAX_PARADAS_POR_TRAYECTO, inicio);

    const log = this.logRepo.create({
      cartera: { id: carteraId } as Cartera,
      carteraId,
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

  async consultar(carteraId: number, requester: RequesterTrayectoContext): Promise<TrayectoPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const log = await this.logRepo.findOne({
      where: { cartera: { id: carteraId }, tipo: "planificada" },
      order: { fecha: "DESC", id: "DESC" },
    });
    if (!log) {
      throw new NotFoundException("No hay trayecto planificado para esta cartera");
    }
    return {
      id: log.id,
      carteraId: log.carteraId,
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

  /** Última posición conocida del gestor de la cartera; sin ella, undefined. */
  private async ubicacionDelGestor(
    cartera: Cartera,
    requester: RequesterTrayectoContext,
  ): Promise<PuntoInicio | undefined> {
    const gestorId = cartera.gestorId ?? (requester.rol === "gestor" ? requester.sub : undefined);
    if (gestorId === undefined) {
      return undefined;
    }
    const posicion = await this.posicionRepo.findOne({
      where: { gestorId, carteraId: cartera.id },
    });
    return posicion ? { latitud: posicion.latitud, longitud: posicion.longitud } : undefined;
  }

  private async obtenerClientesDelDia(carteraId: number): Promise<ParadaGeo[]> {
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
      .where("c.cartera_id = :carteraId", { carteraId })
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