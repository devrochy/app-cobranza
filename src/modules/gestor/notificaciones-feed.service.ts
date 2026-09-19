import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { Cartera } from "../carteras/cartera.entity";

export type NotificacionTipo =
  | "pago"
  | "gasto"
  | "no_pago"
  | "aprobacion"
  | "liquidacion";

export interface NotificacionPublic {
  id: string;
  tipo: NotificacionTipo;
  mensaje: string;
  carteraId: number;
  carteraNombre: string;
  clienteId: number | null;
  monto: number | null;
  fecha: string;
}

export interface RequesterFeed {
  rol: RolUsuario;
  sub: number;
}

interface FilaNotificacion {
  tipo: NotificacionTipo;
  refId: number | string;
  carteraId: number | string;
  carteraNombre: string;
  clienteId: number | string | null;
  clienteNombre: string | null;
  monto: string | number | null;
  detalle: string | null;
  fecha: string | Date;
}

const SQL_FEED = `
  SELECT 'pago' AS tipo, p.id AS "refId", cl.cartera_id AS "carteraId",
         ca.nombre AS "carteraNombre", p.cliente_id AS "clienteId",
         TRIM(cl.nombre || ' ' || cl.apellido) AS "clienteNombre",
         p.valor AS monto, NULL AS detalle, p.fecha_hora AS fecha
  FROM pagos p
  JOIN clientes cl ON cl.id = p.cliente_id
  JOIN carteras ca ON ca.id = cl.cartera_id
  WHERE cl.cartera_id = ANY($1)

  UNION ALL

  SELECT 'gasto', g.id, g.cartera_id, ca.nombre, NULL, NULL, g.valor, g.descripcion, g.fecha_hora
  FROM gastos g
  JOIN carteras ca ON ca.id = g.cartera_id
  WHERE g.cartera_id = ANY($1) AND g.estado = 'activo'

  UNION ALL

  SELECT 'no_pago', v.id, v.cartera_id, ca.nombre, v.cliente_id,
         TRIM(cl.nombre || ' ' || cl.apellido), NULL, v.motivo_no_pago, v.created_at
  FROM visitas v
  JOIN clientes cl ON cl.id = v.cliente_id
  JOIN carteras ca ON ca.id = v.cartera_id
  WHERE v.cartera_id = ANY($1) AND v.resultado = 'no_pago'

  UNION ALL

  SELECT 'aprobacion', c.id, cl.cartera_id, ca.nombre, c.cliente_id,
         TRIM(cl.nombre || ' ' || cl.apellido), NULL, NULL, c.revisado_en
  FROM cambios_cliente_pendientes c
  JOIN clientes cl ON cl.id = c.cliente_id
  JOIN carteras ca ON ca.id = cl.cartera_id
  WHERE cl.cartera_id = ANY($1) AND c.estado = 'aprobado' AND c.revisado_en IS NOT NULL

  UNION ALL

  SELECT 'liquidacion', l.id, l.cartera_id, ca.nombre, NULL, NULL,
         l.total_cobrado_periodo, l.periodo, l.created_at
  FROM liquidaciones l
  JOIN carteras ca ON ca.id = l.cartera_id
  WHERE l.cartera_id = ANY($1)

  ORDER BY fecha DESC
  LIMIT $2
`;

/**
 * Feed de notificaciones del APK: agrega eventos recientes (pagos, gastos,
 * no-pagos, aprobaciones de cambio de cliente y liquidaciones) de las carteras
 * del requester. El "no leído" se resuelve en el dispositivo (lastSeen).
 */
@Injectable()
export class NotificacionesFeedService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    private readonly dataSource: DataSource,
  ) {}

  async listar(requester: RequesterFeed, limite = 30): Promise<NotificacionPublic[]> {
    const where =
      requester.rol === "propietario"
        ? { propietario: { id: requester.sub } }
        : { gestor: { id: requester.sub } };
    const carteras = await this.carteraRepo.find({ where });
    if (carteras.length === 0) {
      return [];
    }
    const ids = carteras.map((cartera) => cartera.id);
    const filas = await this.dataSource.query<FilaNotificacion[]>(SQL_FEED, [
      ids,
      limite,
    ]);
    return filas.map((fila) => this.toPublic(fila));
  }

  private toPublic(fila: FilaNotificacion): NotificacionPublic {
    const monto =
      fila.monto === null || fila.monto === undefined ? null : Number(fila.monto);
    return {
      id: `${fila.tipo}-${fila.refId}`,
      tipo: fila.tipo,
      mensaje: this.mensaje(fila, monto),
      carteraId: Number(fila.carteraId),
      carteraNombre: fila.carteraNombre,
      clienteId: fila.clienteId === null ? null : Number(fila.clienteId),
      monto,
      fecha: new Date(fila.fecha).toISOString(),
    };
  }

  private mensaje(fila: FilaNotificacion, monto: number | null): string {
    const cliente = fila.clienteNombre ?? "Cliente";
    switch (fila.tipo) {
      case "pago":
        return `Pago registrado de ${cliente}`;
      case "gasto":
        return `Gasto registrado: ${fila.detalle ?? ""}`.trim();
      case "no_pago":
        return `No pago de ${cliente}`;
      case "aprobacion":
        return `Cambio aprobado para ${cliente}`;
      case "liquidacion":
        return `Liquidación generada (${fila.detalle ?? ""})`.trim();
      default:
        return monto === null ? "Evento" : `Evento por ${monto}`;
    }
  }
}
