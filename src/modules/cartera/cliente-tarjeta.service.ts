import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { urlArchivoServible } from "../../common/url-archivo";
import { RolUsuario } from "../auth/auth.service";
import { ColorRiesgo } from "../../domain/color-riesgo";
import { diasDeMora, TipoPagoTarjeta, tipoPagoDesdeDiasEntreCuotas } from "../../domain/tarjeta-cliente";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia } from "./cliente-evidencia.entity";

export interface RequesterTarjetaContext {
  rol: RolUsuario;
  sub: number;
}

export interface ClienteTarjetaPublic {
  clienteId: number;
  rutaId: number;
  nombre: string;
  negocio: string | null;
  telefonoWhatsapp: string;
  color: ColorRiesgo;
  fotoUrl: string | null;
  documentoFrenteUrl: string | null;
  documentoReversoUrl: string | null;
  tipoPago: TipoPagoTarjeta | null;
  saldoPendiente: number;
  diasMora: number;
}

@Injectable()
export class ClienteTarjetaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(ClienteEvidencia)
    private readonly evidenciaRepo: Repository<ClienteEvidencia>,
    private readonly dataSource: DataSource,
  ) {}

  async obtener(
    rutaId: number,
    clienteId: number,
    requester: RequesterTarjetaContext,
  ): Promise<ClienteTarjetaPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, ruta: { id: rutaId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta ruta");
    }

    const evidencias = await this.evidenciaRepo.find({
      where: { cliente: { id: clienteId } },
    });
    const urlDe = (tipo: "foto_facial" | "documento_frente" | "documento_reverso") =>
      urlArchivoServible(
        evidencias.find((e) => e.tipo === tipo)?.rutaArchivo ?? null,
      );

    const prestamos = await this.obtenerPrestamosVigentes(clienteId);
    const diasEntreCuotas = prestamos.map((p) => p.diasEntreCuotas);
    const tipoPago = tipoPagoDesdeDiasEntreCuotas(diasEntreCuotas);

    const { saldoPendiente, fechaVencidaMasAntigua } = await this.obtenerSaldoYMorosidad(clienteId);

    return {
      clienteId: cliente.id,
      rutaId,
      nombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
      negocio: cliente.negocio,
      telefonoWhatsapp: cliente.telefonoWhatsapp,
      color: cliente.colorRiesgo,
      fotoUrl: urlDe("foto_facial"),
      documentoFrenteUrl: urlDe("documento_frente"),
      documentoReversoUrl: urlDe("documento_reverso"),
      tipoPago,
      saldoPendiente,
      diasMora: diasDeMora(fechaVencidaMasAntigua),
    };
  }

  private async obtenerPrestamosVigentes(
    clienteId: number,
  ): Promise<Array<{ diasEntreCuotas: number }>> {
    const filas = await this.dataSource.manager
      .createQueryBuilder()
      .select("pr.dias_entre_cuotas", "diasEntreCuotas")
      .from("prestamos", "pr")
      .where("pr.cliente_id = :clienteId", { clienteId })
      .andWhere("pr.estatus = 'vigente'")
      .getRawMany<{ diasEntreCuotas: string }>();
    return filas.map((f) => ({ diasEntreCuotas: Number(f.diasEntreCuotas) }));
  }

  private async obtenerSaldoYMorosidad(
    clienteId: number,
  ): Promise<{ saldoPendiente: number; fechaVencidaMasAntigua: string | Date | null }> {
    const fila = await this.dataSource.manager
      .createQueryBuilder()
      .select("COALESCE(SUM(cu.valor_esperado), 0)", "deuda")
      .addSelect("MIN(CASE WHEN cu.estatus IN ('pendiente','atrasada') THEN cu.fecha_vencimiento END)", "fechaVencida")
      .from("cuotas", "cu")
      .innerJoin("prestamos", "p", "p.id = cu.prestamo_id")
      .where("p.cliente_id = :clienteId", { clienteId })
      .andWhere("p.estatus = 'vigente'")
      .getRawOne<{ deuda: string; fechaVencida: string | Date | null }>();

    const deuda = Number(fila?.deuda ?? 0);
    const abono = await this.dataSource.manager
      .createQueryBuilder()
      .select("COALESCE(SUM(a.valor), 0)", "total")
      .from("abonos", "a")
      .innerJoin("prestamos", "p", "p.id = a.prestamo_id")
      .where("p.cliente_id = :clienteId", { clienteId })
      .andWhere("p.estatus = 'vigente'")
      .getRawOne<{ total: string }>();

    return {
      saldoPendiente: Math.max(0, deuda - Number(abono?.total ?? 0)),
      fechaVencidaMasAntigua: fila?.fechaVencida ?? null,
    };
  }
}