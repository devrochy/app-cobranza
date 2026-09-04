import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, DataSource, EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import {
  calcularComision,
  calcularVentanaPeriodo,
  PeriodoLiquidacion,
} from "../../domain/liquidacion";
import { Pago } from "../cartera/pago.entity";
import { Abono } from "../cartera/abono.entity";
import { Ruta } from "./ruta.entity";
import { RutaConfig } from "./ruta-config.entity";
import { Caja } from "./caja.entity";
import { Liquidacion } from "./liquidacion.entity";

export interface GenerarLiquidacionInput {
  comentario?: string | null;
}

export interface RequesterLiquidacionContext {
  rol: RolUsuario;
  sub: number;
}

export interface ItemLiquidacionDetallePublic {
  id: number;
  clienteId: number;
  clienteNombre: string;
  valor: number;
  metodoPago: string;
  fechaHora: string;
  liquidado: boolean;
}

export interface LiquidacionPublic {
  id: number;
  rutaId: number;
  fecha: string;
  periodo: PeriodoLiquidacion;
  cajaAnterior: number;
  cajaActual: number;
  estimadoACobrar: number;
  totalInyeccion: number;
  totalCobradoPeriodo: number;
  totalCobradoDia: number;
  totalPrestado: number;
  totalGastos: number;
  sumaCartera: number;
  comisionPorcentaje: number;
  comisionValor: number;
  comentario: string | null;
  createdAt: Date;
  pagos: ItemLiquidacionDetallePublic[];
  abonos: ItemLiquidacionDetallePublic[];
}

export interface LiquidacionGlobalPublic extends LiquidacionPublic {
  rutaNombre: string;
}

export interface LiquidacionExport {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class LiquidacionesService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    private readonly dataSource: DataSource,
  ) {}

  async generar(
    rutaId: number,
    input: GenerarLiquidacionInput,
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const config = await this.configRepo.findOne({ where: { ruta: { id: rutaId } } });
    const periodo = config?.periodoLiquidacion ?? "diario";

    const caja = await this.cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!caja) {
      throw new NotFoundException("La caja de la ruta no existe");
    }

    const { inicio, fin } = calcularVentanaPeriodo(periodo, new Date());

    const saved = await this.dataSource.transaction(async (manager) => {
      const liquidacionRepo = manager.getRepository(Liquidacion);
      const cajaRepo = manager.getRepository(Caja);

      const ultima = await liquidacionRepo.findOne({
        where: { ruta: { id: rutaId } },
        order: { fecha: "DESC" },
      });
      if (ultima && this.estaEnVentana(ultima.fecha, inicio, fin)) {
        throw new ConflictException("Ya existe una liquidación para el periodo vigente");
      }

      const cajaActual = await cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
      const cajaAnterior = ultima?.cajaActual ?? caja.saldoInicial;

      const totales = await this.calcularTotales(rutaId, inicio, fin, manager);
      const {
        estimadoACobrar,
        sumaCartera,
        totalCobradoPeriodo,
        totalCobradoDia,
        totalPrestado,
        totalGastos,
        totalInyeccion,
      } = totales;

      const comisionPorcentaje = config?.comisionActiva ? config.comisionPorcentaje : 0;
      const comisionValor = calcularComision(
        totalCobradoPeriodo,
        config?.comisionActiva ?? false,
        config?.comisionPorcentaje ?? 0,
      );

      // Marca como liquidados los pagos y abonos del periodo (fin del día): a
      // partir de la liquidación ya no se pueden borrar desde la APK.
      const pagos = await this.marcarLiquidados(rutaId, inicio, fin, manager);

      const liquidacion = liquidacionRepo.create({
        ruta: { id: rutaId } as Ruta,
        rutaId,
        fecha: this.fechaLocal(new Date()),
        periodo,
        cajaAnterior,
        cajaActual: cajaActual?.saldoActual ?? caja.saldoActual,
        estimadoACobrar,
        totalInyeccion,
        totalCobradoPeriodo,
        totalCobradoDia,
        totalPrestado,
        totalGastos,
        sumaCartera,
        comisionPorcentaje,
        comisionValor,
        comentario: input.comentario ?? null,
      });
      const guardada = await liquidacionRepo.save(liquidacion);
      return {
        liquidacion: guardada,
        pagos: pagos.pagos,
        abonos: pagos.abonos,
      };
    });

    return {
      ...this.toPublic(saved.liquidacion),
      pagos: saved.pagos,
      abonos: saved.abonos,
    };
  }

  async listar(
    rutaId: number,
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionPublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const filas = await this.liquidacionRepo.find({
      where: { ruta: { id: rutaId } },
      order: { fecha: "DESC" },
    });
    return filas.map((l) => this.toPublic(l));
  }

  /**
   * Marca como liquidados los pagos y abonos del periodo (los que quedan dentro
   * de la ventana vigente). Devuelve su detalle para incluir en la respuesta.
   */
  private async marcarLiquidados(
    rutaId: number,
    inicio: Date,
    fin: Date,
    manager: EntityManager,
  ): Promise<{ pagos: ItemLiquidacionDetallePublic[]; abonos: ItemLiquidacionDetallePublic[] }> {
    const ahora = new Date();
    const pagoRepo = manager.getRepository(Pago);
    const abonoRepo = manager.getRepository(Abono);

    const pagos = await pagoRepo.find({
      where: {
        fechaHora: Between(inicio, fin),
        cuota: { prestamo: { ruta: { id: rutaId } } },
      },
      relations: { cliente: true },
    });
    const abonos = await abonoRepo.find({
      where: {
        fechaHora: Between(inicio, fin),
        prestamo: { ruta: { id: rutaId } },
      },
      relations: { cliente: true },
    });

    await pagoRepo.save(
      pagos.map((p) => {
        p.liquidado = true;
        p.fechaLiquidacion = ahora;
        return p;
      }),
    );
    await abonoRepo.save(
      abonos.map((a) => {
        a.liquidado = true;
        a.fechaLiquidacion = ahora;
        return a;
      }),
    );

    return {
      pagos: pagos.map((p) =>
        this.itemDetalle(p.id, p.cliente, p.valor, p.metodoPago, p.fechaHora, p.liquidado, p.clienteId),
      ),
      abonos: abonos.map((a) =>
        this.itemDetalle(a.id, a.cliente, a.valor, a.metodoPago, a.fechaHora, a.liquidado, a.clienteId),
      ),
    };
  }

  async listarGlobal(
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionGlobalPublic[]> {
    const where =
      requester.rol === "socio" ? { ruta: { socio: { id: requester.sub } } } : {};
    const filas = await this.liquidacionRepo.find({
      where,
      relations: { ruta: true },
      order: { fecha: "DESC" },
    });
    return filas.map((l) => ({
      ...this.toPublic(l),
      rutaNombre: l.ruta.nombre,
    }));
  }

  async exportar(
    rutaId: number,
    liquidacionId: number,
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionExport> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const l = await this.liquidacionRepo.findOne({
      where: { id: liquidacionId, ruta: { id: rutaId } },
    });
    if (!l) {
      throw new NotFoundException("La liquidación no existe en esta ruta");
    }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Liquidación");
    hoja.columns = [
      { header: "Campo", key: "campo", width: 30 },
      { header: "Valor", key: "valor", width: 30 },
    ];
    const filas: Array<[string, string | number]> = [
      ["Ruta", ruta.nombre],
      ["Fecha", l.fecha],
      ["Periodo", l.periodo],
      ["Caja anterior", l.cajaAnterior],
      ["Caja actual", l.cajaActual],
      ["Estimado a cobrar", l.estimadoACobrar],
      ["Total inyección", l.totalInyeccion],
      ["Total cobrado periodo", l.totalCobradoPeriodo],
      ["Total cobrado día", l.totalCobradoDia],
      ["Total prestado", l.totalPrestado],
      ["Total gastos", l.totalGastos],
      ["Suma cartera", l.sumaCartera],
      ["Comisión %", l.comisionPorcentaje],
      ["Comisión valor", l.comisionValor],
      ["Comentario", l.comentario ?? ""],
    ];
    filas.forEach(([campo, valor]) => hoja.addRow({ campo, valor }));
    hoja.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: `liquidacion-${l.fecha}.xlsx` };
  }

  /**
   * Exporta el resumen de la liquidación en PDF (con el detalle de pagos y
   * abonos del día). Se usa desde la APK (cobrador) para descargar/compartir.
   */
  async exportarPdf(
    rutaId: number,
    liquidacionId: number,
    requester: RequesterLiquidacionContext,
  ): Promise<LiquidacionExport> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const l = await this.liquidacionRepo.findOne({
      where: { id: liquidacionId, ruta: { id: rutaId } },
    });
    if (!l) {
      throw new NotFoundException("La liquidación no existe en esta ruta");
    }

    const base = new Date(`${l.fecha}T00:00:00`);
    const detalle = await this.obtenerDetalle(rutaId, this.inicioDelDia(base), this.finDelDia(base));

    const { default: PDFDocument } = await import("pdfkit");
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const terminado = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).text(`Liquidación ${ruta.nombre}`, { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#475569").text(`Fecha: ${l.fecha} · Periodo: ${l.periodo}`);
    doc.moveDown();

    const filas: Array<[string, string]> = [
      ["Caja anterior", String(l.cajaAnterior)],
      ["Caja actual", String(l.cajaActual)],
      ["Estimado a cobrar", String(l.estimadoACobrar)],
      ["Total inyección", String(l.totalInyeccion)],
      ["Total cobrado periodo", String(l.totalCobradoPeriodo)],
      ["Total cobrado día", String(l.totalCobradoDia)],
      ["Total prestado", String(l.totalPrestado)],
      ["Total gastos", String(l.totalGastos)],
      ["Suma cartera", String(l.sumaCartera)],
      ["Comisión %", String(l.comisionPorcentaje)],
      ["Comisión valor", String(l.comisionValor)],
    ];
    doc.fontSize(11).fillColor("#0f172a");
    for (const [campo, valor] of filas) {
      doc.text(`${campo}: ${valor}`, { lineGap: 2 });
    }
    if (l.comentario) {
      doc.text(`Comentario: ${l.comentario}`, { lineGap: 2 });
    }

    doc.moveDown();
    doc.fontSize(12).fillColor("#0f172a").text("Pagos del día");
    doc.fontSize(10).fillColor("#334155");
    if (detalle.pagos.length === 0) {
      doc.text("Sin pagos registrados.");
    } else {
      for (const p of detalle.pagos) {
        doc.text(`• ${p.clienteNombre}: ${p.valor} (${p.metodoPago})`, { lineGap: 2 });
      }
    }

    doc.moveDown();
    doc.fontSize(12).fillColor("#0f172a").text("Abonos del día");
    doc.fontSize(10).fillColor("#334155");
    if (detalle.abonos.length === 0) {
      doc.text("Sin abonos registrados.");
    } else {
      for (const a of detalle.abonos) {
        doc.text(`• ${a.clienteNombre}: ${a.valor} (${a.metodoPago})`, { lineGap: 2 });
      }
    }

    doc.end();
    const buffer = await terminado;
    return { buffer, filename: `liquidacion-${l.fecha}.pdf` };
  }

  /** Detalle de pagos/abonos de una ruta dentro de una ventana (sin marcar). */
  private async obtenerDetalle(
    rutaId: number,
    inicio: Date,
    fin: Date,
  ): Promise<{ pagos: ItemLiquidacionDetallePublic[]; abonos: ItemLiquidacionDetallePublic[] }> {
    const pagoRepo = this.dataSource.getRepository(Pago);
    const abonoRepo = this.dataSource.getRepository(Abono);

    const pagos = await pagoRepo.find({
      where: {
        fechaHora: Between(inicio, fin),
        cuota: { prestamo: { ruta: { id: rutaId } } },
      },
      relations: { cliente: true },
    });
    const abonos = await abonoRepo.find({
      where: {
        fechaHora: Between(inicio, fin),
        prestamo: { ruta: { id: rutaId } },
      },
      relations: { cliente: true },
    });

    return {
      pagos: pagos.map((p) => this.itemDetalle(p.id, p.cliente, p.valor, p.metodoPago, p.fechaHora, p.liquidado, p.clienteId)),
      abonos: abonos.map((a) => this.itemDetalle(a.id, a.cliente, a.valor, a.metodoPago, a.fechaHora, a.liquidado, a.clienteId)),
    };
  }

  private itemDetalle(
    id: number,
    cliente: { nombre: string; apellido: string } | null | undefined,
    valor: number,
    metodoPago: string,
    fechaHora: Date,
    liquidado: boolean,
    clienteId: number,
  ): ItemLiquidacionDetallePublic {
    return {
      id,
      clienteId,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}`.trim() : "",
      valor,
      metodoPago,
      fechaHora: fechaHora.toISOString(),
      liquidado,
    };
  }

  private estaEnVentana(fecha: string, inicio: Date, fin: Date): boolean {
    const d = new Date(`${fecha}T00:00:00`);
    d.setHours(0, 0, 0, 0);
    const ini = new Date(inicio);
    ini.setHours(0, 0, 0, 0);
    const finD = new Date(fin);
    finD.setHours(23, 59, 59, 999);
    return d >= ini && d <= finD;
  }

  private inicioDelDia(fin: Date): Date {
    const d = new Date(fin);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private finDelDia(fin: Date): Date {
    const d = new Date(fin);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private fechaLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private qb(manager?: EntityManager) {
    return manager ? manager.createQueryBuilder() : this.liquidacionRepo.createQueryBuilder();
  }

  private async sumaCuotasPendientes(
    rutaId: number,
    inicio: Date,
    fin: Date,
    manager?: EntityManager,
  ): Promise<number> {
    const row = await this.qb(manager)
      .select("COALESCE(SUM(c.valor_esperado), 0)", "total")
      .from("cuotas", "c")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("c.estatus IN (:...estatus)", { estatus: ["pendiente", "atrasada"] })
      .andWhere("c.fecha_vencimiento >= :inicio", { inicio })
      .andWhere("c.fecha_vencimiento <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaAbonos(rutaId: number, manager?: EntityManager): Promise<number> {
    const row = await this.qb(manager)
      .select("COALESCE(SUM(a.valor), 0)", "total")
      .from("abonos", "a")
      .innerJoin("prestamos", "p", "p.id = a.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaPagos(rutaId: number, inicio: Date, fin: Date, manager?: EntityManager): Promise<number> {
    // Solo pagos de cuotas atribuibles a la ruta (vía cuota → préstamo).
    // Los pagos con cuota_id NULL (huérfanos tras HU-48) no se atribuyen aquí.
    const row = await this.qb(manager)
      .select("COALESCE(SUM(pa.valor), 0)", "total")
      .from("pagos", "pa")
      .innerJoin("cuotas", "c", "c.id = pa.cuota_id")
      .innerJoin("prestamos", "p", "p.id = c.prestamo_id")
      .where("p.ruta_id = :rutaId", { rutaId })
      .andWhere("p.estatus = :vigente", { vigente: "vigente" })
      .andWhere("pa.fecha_hora >= :inicio", { inicio })
      .andWhere("pa.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaPrestamos(rutaId: number, inicio: Date, fin: Date, manager?: EntityManager): Promise<number> {
    const row = await this.qb(manager)
      .select("COALESCE(SUM(pr.valor), 0)", "total")
      .from("prestamos", "pr")
      .where("pr.ruta_id = :rutaId", { rutaId })
      .andWhere("pr.fecha_otorgado >= :inicio", { inicio })
      .andWhere("pr.fecha_otorgado <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaGastosAprobados(rutaId: number, inicio: Date, fin: Date, manager?: EntityManager): Promise<number> {
    const row = await this.qb(manager)
      .select("COALESCE(SUM(g.valor), 0)", "total")
      .from("gastos", "g")
      .where("g.ruta_id = :rutaId", { rutaId })
      .andWhere("g.aprobado = true")
      .andWhere("g.estado = :activo", { activo: "activo" })
      .andWhere("g.fecha_hora >= :inicio", { inicio })
      .andWhere("g.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumaInyeccionesActivas(rutaId: number, inicio: Date, fin: Date, manager?: EntityManager): Promise<number> {
    const row = await this.qb(manager)
      .select("COALESCE(SUM(i.valor), 0)", "total")
      .from("inyecciones", "i")
      .where("i.ruta_id = :rutaId", { rutaId })
      .andWhere("i.estado = :estado", { estado: "activa" })
      .andWhere("i.fecha_hora >= :inicio", { inicio })
      .andWhere("i.fecha_hora <= :fin", { fin })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  async calcularTotales(
    rutaId: number,
    inicio: Date,
    fin: Date,
    manager?: EntityManager,
  ): Promise<{
    estimadoACobrar: number;
    sumaCartera: number;
    totalCobradoPeriodo: number;
    totalCobradoDia: number;
    totalPrestado: number;
    totalGastos: number;
    totalInyeccion: number;
  }> {
    const estimadoACobrar = await this.sumaCuotasPendientes(rutaId, inicio, fin, manager);
    const sumaAbonos = await this.sumaAbonos(rutaId, manager);
    const sumaCartera = Math.max(0, estimadoACobrar - sumaAbonos);
    const totalCobradoPeriodo = await this.sumaPagos(rutaId, inicio, fin, manager);
    const totalCobradoDia = await this.sumaPagos(rutaId, this.inicioDelDia(fin), this.finDelDia(fin), manager);
    const totalPrestado = await this.sumaPrestamos(rutaId, inicio, fin, manager);
    const totalGastos = await this.sumaGastosAprobados(rutaId, inicio, fin, manager);
    const totalInyeccion = await this.sumaInyeccionesActivas(rutaId, inicio, fin, manager);
    return {
      estimadoACobrar,
      sumaCartera,
      totalCobradoPeriodo,
      totalCobradoDia,
      totalPrestado,
      totalGastos,
      totalInyeccion,
    };
  }

  private toPublic(l: Liquidacion): LiquidacionPublic {
    return {
      id: l.id,
      rutaId: l.rutaId,
      fecha: l.fecha,
      periodo: l.periodo,
      cajaAnterior: l.cajaAnterior,
      cajaActual: l.cajaActual,
      estimadoACobrar: l.estimadoACobrar,
      totalInyeccion: l.totalInyeccion,
      totalCobradoPeriodo: l.totalCobradoPeriodo,
      totalCobradoDia: l.totalCobradoDia,
      totalPrestado: l.totalPrestado,
      totalGastos: l.totalGastos,
      sumaCartera: l.sumaCartera,
      comisionPorcentaje: l.comisionPorcentaje,
      comisionValor: l.comisionValor,
      comentario: l.comentario,
      createdAt: l.createdAt,
      pagos: [],
      abonos: [],
    };
  }
}