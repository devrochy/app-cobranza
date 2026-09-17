import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { fromPoint } from "../../common/geo";
import { urlArchivoServible } from "../../common/url-archivo";
import { RolUsuario } from "../auth/auth.service";
import { ColorRiesgo } from "../../domain/color-riesgo";
import { TipoDocumento } from "../../domain/tipo-documento";
import { diasDeMora, TipoPagoTarjeta, tipoPagoDesdeDiasEntreCuotas } from "../../domain/tarjeta-cliente";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "./cliente.entity";
import { ClienteEvidencia, esTipoEvidenciaCliente } from "./cliente-evidencia.entity";
import type { EvidenciaArchivo } from "../../common/descarga-archivo";

export interface RequesterTarjetaContext {
  rol: RolUsuario;
  sub: number;
}

export interface ClienteTarjetaPublic {
  clienteId: number;
  carteraId: number;
  nombre: string;
  negocio: string | null;
  telefonoWhatsapp: string;
  color: ColorRiesgo;
  fotoUrl: string | null;
  documentoFrenteUrl: string | null;
  documentoReversoUrl: string | null;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  latitud: number;
  longitud: number;
  latitudDomicilio: number | null;
  longitudDomicilio: number | null;
  tipoPago: TipoPagoTarjeta | null;
  saldoPendiente: number;
  diasMora: number;
}

@Injectable()
export class ClienteTarjetaService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(ClienteEvidencia)
    private readonly evidenciaRepo: Repository<ClienteEvidencia>,
    private readonly dataSource: DataSource,
  ) {}

  async obtener(
    carteraId: number,
    clienteId: number,
    requester: RequesterTarjetaContext,
  ): Promise<ClienteTarjetaPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, cartera: { id: carteraId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta cartera");
    }

    const evidencias = await this.evidenciaRepo.find({
      where: { cliente: { id: clienteId } },
    });
    const urlDe = (tipo: "foto_facial" | "documento_frente" | "documento_reverso") =>
      urlArchivoServible(
        evidencias.find((e) => e.tipo === tipo)?.carteraArchivo ?? null,
      );

    const prestamos = await this.obtenerPrestamosVigentes(clienteId);
    const diasEntreCuotas = prestamos.map((p) => p.diasEntreCuotas);
    const tipoPago = tipoPagoDesdeDiasEntreCuotas(diasEntreCuotas);

    const { saldoPendiente, fechaVencidaMasAntigua } = await this.obtenerSaldoYMorosidad(clienteId);
    const { latitud, longitud } = fromPoint(cliente.ubicacion);

    return {
      clienteId: cliente.id,
      carteraId,
      nombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
      negocio: cliente.negocio,
      telefonoWhatsapp: cliente.telefonoWhatsapp,
      color: cliente.colorRiesgo,
      fotoUrl: urlDe("foto_facial"),
      documentoFrenteUrl: urlDe("documento_frente"),
      documentoReversoUrl: urlDe("documento_reverso"),
      tipoDocumento: cliente.tipoDocumento,
      numeroDocumento: cliente.numeroDocumento,
      latitud,
      longitud,
      latitudDomicilio: cliente.ubicacionDomicilio
        ? fromPoint(cliente.ubicacionDomicilio).latitud
        : null,
      longitudDomicilio: cliente.ubicacionDomicilio
        ? fromPoint(cliente.ubicacionDomicilio).longitud
        : null,
      tipoPago,
      saldoPendiente,
      diasMora: diasDeMora(fechaVencidaMasAntigua),
    };
  }

  async descargarEvidencia(
    carteraId: number,
    clienteId: number,
    tipo: string,
    requester: RequesterTarjetaContext,
  ): Promise<EvidenciaArchivo> {
    if (!esTipoEvidenciaCliente(tipo)) {
      throw new NotFoundException("La evidencia no existe");
    }

    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, cartera: { id: carteraId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta cartera");
    }

    const evidencia = await this.evidenciaRepo.findOne({
      where: { cliente: { id: clienteId }, tipo },
    });
    if (!evidencia) {
      throw new NotFoundException("La evidencia no existe");
    }

    return {
      carteraArchivo: evidencia.carteraArchivo,
      mimetype: evidencia.mimetype,
      nombreOriginal: evidencia.nombreOriginal,
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