import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { formatDate } from "../../common/date";
import { RolUsuario } from "../auth/auth.service";
import {
  calcularDeltas,
  conteosDesdeSnapshot,
  EstadisticasConteos,
  EstadisticasRuta,
} from "../../domain/estadisticas-ruta";
import { Ruta } from "./ruta.entity";
import { Liquidacion } from "./liquidacion.entity";
import { RutaEstadisticasSnapshot } from "./ruta-estadisticas-snapshot.entity";

export interface RequesterEstadisticasContext {
  rol: RolUsuario;
  sub: number;
}

/**
 * Conteos operativos por ruta y su snapshot diario.
 *
 * Definiciones (acordadas con el negocio):
 * - clientesAtrasados: clientes con color de riesgo "rojo".
 * - clientesVencidos: clientes con al menos una cuota en estatus "atrasada".
 * - sinVisitaHoy: clientes de la lista del día sin visita registrada (pago o
 *   no pago) en la fecha.
 * - sinVisitaDesdeUltimaLiquidada: clientes sin visitas desde la fecha de la
 *   última liquidación (si no hay liquidación, sin ninguna visita).
 * - conPrestamosNuevos: con un préstamo otorgado en la fecha.
 * - conMasDeUnPrestamo: con más de un préstamo vigente.
 * - clientesNuevos: clientes creados en la fecha.
 */
@Injectable()
export class EstadisticasRutaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    @InjectRepository(RutaEstadisticasSnapshot)
    private readonly snapshotRepo: Repository<RutaEstadisticasSnapshot>,
    private readonly dataSource: DataSource,
  ) {}

  /** Fecha local (YYYY-MM-DD) tomada del reloj del servidor. */
  fechaDeHoy(): string {
    return this.fechaLocal(new Date());
  }

  /**
   * Actual = calculado al vuelo; anterior = snapshot de ayer. Si el job no
   * corrió ayer, se usa el último snapshot previo disponible.
   */
  async obtener(
    rutaId: number,
    requester: RequesterEstadisticasContext,
  ): Promise<EstadisticasRuta> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const fecha = this.fechaDeHoy();
    const actual = await this.calcular(rutaId, fecha);
    const anterior =
      (await this.leerSnapshot(rutaId, this.fechaAnterior(fecha))) ??
      (await this.ultimoSnapshotAnteriorA(rutaId, fecha));

    return {
      rutaId,
      fecha,
      actual,
      anterior,
      deltas: calcularDeltas(actual, anterior),
      actualizadoEn: new Date().toISOString(),
    };
  }

  async calcular(rutaId: number, fecha: string): Promise<EstadisticasConteos> {
    const [
      totalClientes,
      clientesAtrasados,
      clientesVencidos,
      sinVisitaHoy,
      sinVisitaDesdeUltimaLiquidada,
      conPrestamosNuevos,
      conMasDeUnPrestamo,
      clientesNuevos,
    ] = await Promise.all([
      this.contarClientesActivos(rutaId),
      this.contarClientesActivos(rutaId, 'c."colorRiesgo" = :color', { color: "rojo" }),
      this.contarClientesVencidos(rutaId),
      this.contarSinVisitaHoy(rutaId, fecha),
      this.contarSinVisitaDesdeLiquidada(rutaId),
      this.contarConPrestamosNuevos(rutaId, fecha),
      this.contarConMasDeUnPrestamo(rutaId),
      this.contarClientesActivos(rutaId, "c.created_at::date = :fecha", { fecha }),
    ]);

    return {
      totalClientes,
      clientesAtrasados,
      clientesVencidos,
      sinVisitaHoy,
      sinVisitaDesdeUltimaLiquidada,
      conPrestamosNuevos,
      conMasDeUnPrestamo,
      clientesNuevos,
    };
  }

  /** Calcula y persiste (upsert) el snapshot de una ruta para una fecha. */
  async persistirSnapshot(rutaId: number, fecha: string): Promise<RutaEstadisticasSnapshot> {
    const conteos = await this.calcular(rutaId, fecha);
    let snapshot = await this.snapshotRepo.findOne({
      where: { ruta: { id: rutaId }, fecha },
    });

    if (!snapshot) {
      snapshot = this.snapshotRepo.create({
        ruta: { id: rutaId } as Ruta,
        fecha,
        ...conteos,
      });
    } else {
      Object.assign(snapshot, conteos);
    }

    return this.snapshotRepo.save(snapshot);
  }

  /** Persiste el snapshot de todas las rutas; devuelve cuántas se guardaron. */
  async persistirTodasLasRutas(fecha: string): Promise<number> {
    const rutas = await this.rutaRepo.find({ select: { id: true } });
    let guardadas = 0;
    for (const ruta of rutas) {
      await this.persistirSnapshot(ruta.id, fecha);
      guardadas += 1;
    }
    return guardadas;
  }

  private async leerSnapshot(
    rutaId: number,
    fecha: string,
  ): Promise<EstadisticasConteos | null> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { ruta: { id: rutaId }, fecha },
    });
    return snapshot ? conteosDesdeSnapshot(snapshot) : null;
  }

  private async ultimoSnapshotAnteriorA(
    rutaId: number,
    fecha: string,
  ): Promise<EstadisticasConteos | null> {
    const snapshot = await this.snapshotRepo
      .createQueryBuilder("s")
      .where("s.ruta_id = :rutaId", { rutaId })
      .andWhere("s.fecha < :fecha", { fecha })
      .orderBy("s.fecha", "DESC")
      .getOne();
    return snapshot ? conteosDesdeSnapshot(snapshot) : null;
  }

  private async contarClientesActivos(
    rutaId: number,
    filtro?: string,
    params: Record<string, unknown> = {},
  ): Promise<number> {
    const qb = this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(*)::int", "total")
      .from("clientes", "c")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'");
    if (filtro) {
      qb.andWhere(filtro, params);
    }
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarClientesVencidos(rutaId: number): Promise<number> {
    const row = await this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(DISTINCT c.id)::int", "total")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.ruta_id = :rutaId", { rutaId })
      .innerJoin("cuotas", "cu", "cu.prestamo_id = p.id AND cu.estatus = 'atrasada'")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarConPrestamosNuevos(rutaId: number, fecha: string): Promise<number> {
    const row = await this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(DISTINCT c.id)::int", "total")
      .from("prestamos", "p")
      .innerJoin("clientes", "c", "c.id = p.cliente_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .andWhere("p.fecha_otorgado::date = :fecha", { fecha })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarConMasDeUnPrestamo(rutaId: number): Promise<number> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .from("clientes", "c")
      .innerJoin(
        "prestamos",
        "p",
        "p.cliente_id = c.id AND p.ruta_id = :rutaId AND p.estatus = 'vigente'",
        { rutaId },
      )
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .groupBy("c.id")
      .having("COUNT(p.id) > 1")
      .getRawMany<{ clienteId: string }>();
    return filas.length;
  }

  private async contarSinVisitaHoy(rutaId: number, fecha: string): Promise<number> {
    const delDia = await this.clientesDelDia(rutaId, fecha);
    if (delDia.length === 0) {
      return 0;
    }

    const visitados = await this.dataSource.manager
      .createQueryBuilder()
      .select("DISTINCT v.cliente_id", "clienteId")
      .from("visitas", "v")
      .where("v.ruta_id = :rutaId", { rutaId })
      .andWhere("v.fecha = :fecha", { fecha })
      .andWhere("v.resultado IN ('pago', 'no_pago')")
      .andWhere("v.cliente_id IN (:...ids)", { ids: delDia })
      .getRawMany<{ clienteId: string }>();

    return delDia.length - new Set(visitados.map((v) => Number(v.clienteId))).size;
  }

  /** Clientes de la lista del día (misma regla que la lista operativa). */
  private async clientesDelDia(rutaId: number, fecha: string): Promise<number[]> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.estatus = 'vigente'")
      .leftJoin("cuotas", "cu", "cu.prestamo_id = p.id")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .groupBy("c.id")
      .having(
        "MAX(CASE WHEN cu.fecha_vencimiento = :fecha AND cu.estatus IN ('pendiente','atrasada','pagada') THEN 1 ELSE 0 END) = 1 " +
          "OR MAX(CASE WHEN cu.estatus IN ('pendiente','atrasada') AND cu.fecha_vencimiento < :fecha THEN 1 ELSE 0 END) = 1 " +
          "OR EXISTS (SELECT 1 FROM promesas_pago pr JOIN prestamos p2 ON p2.id = pr.prestamo_id " +
          "WHERE p2.cliente_id = c.id AND pr.fecha_prometida = :fecha)",
      )
      .setParameter("fecha", fecha)
      .getRawMany<{ clienteId: string }>();
    return filas.map((f) => Number(f.clienteId));
  }

  private async contarSinVisitaDesdeLiquidada(rutaId: number): Promise<number> {
    const ultima = await this.liquidacionRepo.findOne({
      where: { ruta: { id: rutaId } },
      order: { fecha: "DESC" },
    });
    const fechaRef = ultima?.fecha ?? null;

    const qb = this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(*)::int", "total")
      .from("clientes", "c")
      .where("c.ruta_id = :rutaId", { rutaId })
      .andWhere("c.estatus = 'activo'")
      .andWhere(
        "NOT EXISTS (SELECT 1 FROM visitas v WHERE v.cliente_id = c.id AND v.ruta_id = :rutaId" +
          (fechaRef ? " AND v.fecha >= :fechaRef" : "") +
          ")",
      );
    if (fechaRef) {
      qb.setParameter("fechaRef", fechaRef);
    }

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }

  private fechaAnterior(fecha: string): string {
    const [year, month, day] = fecha.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 1);
    return formatDate(date);
  }
}
