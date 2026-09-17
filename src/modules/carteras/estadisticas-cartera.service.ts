import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { formatDate } from "../../common/date";
import { RolUsuario } from "../auth/auth.service";
import {
  calcularDeltas,
  conteosDesdeSnapshot,
  EstadisticasConteos,
  EstadisticasCartera,
} from "../../domain/estadisticas-cartera";
import { ClienteBreve } from "../../domain/reporte-diario";
import { Cartera } from "./cartera.entity";
import { Liquidacion } from "./liquidacion.entity";
import { CarteraEstadisticasSnapshot } from "./cartera-estadisticas-snapshot.entity";

export interface RequesterEstadisticasContext {
  rol: RolUsuario;
  sub: number;
}

/**
 * Conteos operativos por cartera y su snapshot diario.
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
export class EstadisticasCarteraService {
  private readonly logger = new Logger(EstadisticasCarteraService.name);

  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    @InjectRepository(CarteraEstadisticasSnapshot)
    private readonly snapshotRepo: Repository<CarteraEstadisticasSnapshot>,
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
    carteraId: number,
    requester: RequesterEstadisticasContext,
  ): Promise<EstadisticasCartera> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const fecha = this.fechaDeHoy();
    const actual = await this.calcular(carteraId, fecha);
    const anterior =
      (await this.leerSnapshot(carteraId, this.fechaAnterior(fecha))) ??
      (await this.ultimoSnapshotAnteriorA(carteraId, fecha));

    return {
      carteraId,
      fecha,
      actual,
      anterior,
      deltas: calcularDeltas(actual, anterior),
      actualizadoEn: new Date().toISOString(),
    };
  }

  async calcular(carteraId: number, fecha: string): Promise<EstadisticasConteos> {
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
      this.contarClientesActivos(carteraId),
      this.contarClientesActivos(carteraId, 'c."colorRiesgo" = :color', { color: "rojo" }),
      this.contarClientesVencidos(carteraId),
      this.contarSinVisitaHoy(carteraId, fecha),
      this.contarSinVisitaDesdeLiquidada(carteraId),
      this.contarConPrestamosNuevos(carteraId, fecha),
      this.contarConMasDeUnPrestamo(carteraId),
      this.contarClientesActivos(carteraId, "c.created_at::date = :fecha", { fecha }),
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

  /** Calcula y persiste (upsert) el snapshot de una cartera para una fecha. */
  async persistirSnapshot(carteraId: number, fecha: string): Promise<CarteraEstadisticasSnapshot> {
    const conteos = await this.calcular(carteraId, fecha);
    let snapshot = await this.snapshotRepo.findOne({
      where: { cartera: { id: carteraId }, fecha },
    });

    if (!snapshot) {
      snapshot = this.snapshotRepo.create({
        cartera: { id: carteraId } as Cartera,
        fecha,
        ...conteos,
      });
    } else {
      Object.assign(snapshot, conteos);
    }

    return this.snapshotRepo.save(snapshot);
  }

  /**
   * Persiste el snapshot de todas las carteras; devuelve cuántas se guardaron.
   * Aisla los errores por cartera para que una cartera con problemas no aborte el job.
   */
  async persistirTodasLasCarteras(fecha: string): Promise<number> {
    const carteras = await this.carteraRepo.find({ select: { id: true } });
    let guardadas = 0;
    for (const cartera of carteras) {
      try {
        await this.persistirSnapshot(cartera.id, fecha);
        guardadas += 1;
      } catch (err) {
        this.logger.error(`Snapshot de estadísticas falló para la cartera ${cartera.id}`, err as Error);
      }
    }
    return guardadas;
  }

  private async leerSnapshot(
    carteraId: number,
    fecha: string,
  ): Promise<EstadisticasConteos | null> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { cartera: { id: carteraId }, fecha },
    });
    return snapshot ? conteosDesdeSnapshot(snapshot) : null;
  }

  private async ultimoSnapshotAnteriorA(
    carteraId: number,
    fecha: string,
  ): Promise<EstadisticasConteos | null> {
    const snapshot = await this.snapshotRepo
      .createQueryBuilder("s")
      .where("s.cartera_id = :carteraId", { carteraId })
      .andWhere("s.fecha < :fecha", { fecha })
      .orderBy("s.fecha", "DESC")
      .getOne();
    return snapshot ? conteosDesdeSnapshot(snapshot) : null;
  }

  private async contarClientesActivos(
    carteraId: number,
    filtro?: string,
    params: Record<string, unknown> = {},
  ): Promise<number> {
    const qb = this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(*)::int", "total")
      .from("clientes", "c")
      .where("c.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'");
    if (filtro) {
      qb.andWhere(filtro, params);
    }
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarClientesVencidos(carteraId: number): Promise<number> {
    const row = await this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(DISTINCT c.id)::int", "total")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.cartera_id = :carteraId", { carteraId })
      .innerJoin("cuotas", "cu", "cu.prestamo_id = p.id AND cu.estatus = 'atrasada'")
      // Solo préstamos vigentes: un préstamo liquidado por abono deja cuotas
      // "atrasada" sin tocar y no debe contar como cliente vencido (HU-48).
      .where("p.estatus = 'vigente'")
      .andWhere("c.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'")
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarConPrestamosNuevos(carteraId: number, fecha: string): Promise<number> {
    const row = await this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(DISTINCT c.id)::int", "total")
      .from("prestamos", "p")
      .innerJoin("clientes", "c", "c.id = p.cliente_id")
      .where("p.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'")
      .andWhere("p.fecha_otorgado::date = :fecha", { fecha })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async contarConMasDeUnPrestamo(carteraId: number): Promise<number> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .from("clientes", "c")
      .innerJoin(
        "prestamos",
        "p",
        "p.cliente_id = c.id AND p.cartera_id = :carteraId AND p.estatus = 'vigente'",
        { carteraId },
      )
      .where("c.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'")
      .groupBy("c.id")
      .having("COUNT(p.id) > 1")
      .getRawMany<{ clienteId: string }>();
    return filas.length;
  }

  private async contarSinVisitaHoy(carteraId: number, fecha: string): Promise<number> {
    const delDia = await this.clientesDelDia(carteraId, fecha);
    if (delDia.length === 0) {
      return 0;
    }

    const visitados = await this.dataSource.manager
      .createQueryBuilder()
      .select("DISTINCT v.cliente_id", "clienteId")
      .from("visitas", "v")
      .where("v.cartera_id = :carteraId", { carteraId })
      .andWhere("v.fecha = :fecha", { fecha })
      .andWhere("v.resultado IN ('pago', 'no_pago')")
      .andWhere("v.cliente_id IN (:...ids)", { ids: delDia.map((c) => c.clienteId) })
      .getRawMany<{ clienteId: string }>();

    return delDia.length - new Set(visitados.map((v) => Number(v.clienteId))).size;
  }

  /**
   * Clientes de la lista del día (misma regla que la lista operativa):
   * cuota que vence la fecha, cuota en mora o compromiso con fecha prometida.
   */
  async clientesDelDia(carteraId: number, fecha: string): Promise<ClienteBreve[]> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("c.id", "clienteId")
      .addSelect("c.nombre || ' ' || c.apellido", "nombre")
      .from("clientes", "c")
      .innerJoin("prestamos", "p", "p.cliente_id = c.id AND p.estatus = 'vigente'")
      .leftJoin("cuotas", "cu", "cu.prestamo_id = p.id")
      .where("c.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'")
      .groupBy("c.id")
      .having(
        "MAX(CASE WHEN cu.fecha_vencimiento = :fecha AND cu.estatus IN ('pendiente','atrasada','pagada') THEN 1 ELSE 0 END) = 1 " +
          "OR MAX(CASE WHEN cu.estatus IN ('pendiente','atrasada') AND cu.fecha_vencimiento < :fecha THEN 1 ELSE 0 END) = 1 " +
          "OR EXISTS (SELECT 1 FROM promesas_pago pr JOIN prestamos p2 ON p2.id = pr.prestamo_id " +
          "WHERE p2.cliente_id = c.id AND pr.fecha_prometida = :fecha)",
      )
      .setParameter("fecha", fecha)
      .getRawMany<{ clienteId: string; nombre: string }>();
    return filas.map((f) => ({ clienteId: Number(f.clienteId), nombre: f.nombre }));
  }

  private async contarSinVisitaDesdeLiquidada(carteraId: number): Promise<number> {
    const ultima = await this.liquidacionRepo.findOne({
      where: { cartera: { id: carteraId } },
      order: { fecha: "DESC" },
    });
    const fechaRef = ultima?.fecha ?? null;

    const qb = this.dataSource.manager
      .createQueryBuilder()
      .select("COUNT(*)::int", "total")
      .from("clientes", "c")
      .where("c.cartera_id = :carteraId", { carteraId })
      .andWhere("c.estatus = 'activo'")
      .andWhere(
        "NOT EXISTS (SELECT 1 FROM visitas v WHERE v.cliente_id = c.id AND v.cartera_id = :carteraId" +
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
