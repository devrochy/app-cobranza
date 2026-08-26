import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { MetodoPago } from "../../domain/metodo-pago";
import { Ruta } from "../rutas/ruta.entity";
import { Socio } from "../socios/socio.entity";
import { CobroSocio, CobroSocioEstado } from "./cobro-socio.entity";
import { calcularFechaVencimiento, diaAnclaDe, fechaGeneracionCobro, periodoDeFecha } from "./cobro-fecha";
import { LinkPago, LinkPagoEstado } from "./link-pago.entity";

export interface RegistrarPagoInput {
  montoPagado: number;
  metodoPago: MetodoPago;
  fechaPago?: string;
  registradoPor: number;
}

export interface CobroSocioPublic {
  id: number;
  socioId: number;
  periodo: string;
  montoCalculado: number;
  montoPagado: number | null;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: CobroSocioEstado;
  metodoPago: MetodoPago | null;
  registradoPor: number | null;
  createdAt: Date;
  socio?: { id: number; nombre: string; apellido: string; moneda: string } | null;
  linkPago?: { id: number; url: string; estado: LinkPagoEstado; proveedor: string } | null;
}

export interface ListarCobrosFiltros {
  socioId?: number;
  periodo?: string;
  estado?: CobroSocioEstado;
}

const MOCK_LINK_BASE = "https://pago.mock/cobros-socio";

/**
 * Cobro mensual a socios (HU-60): cálculo = suma del costo_cobro de las rutas
 * activas del socio (en la moneda del socio), vencimiento anclado al día de alta,
 * registro de pago con historial y link de pago mock (PRD 6.4).
 */
@Injectable()
export class CobrosSocioService {
  constructor(
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(CobroSocio)
    private readonly cobroRepo: Repository<CobroSocio>,
    @InjectRepository(LinkPago)
    private readonly linkRepo: Repository<LinkPago>,
  ) {}

  async calcularCobro(socioId: number): Promise<number> {
    const rutas = await this.rutaRepo.find({
      where: { socio: { id: socioId }, estatus: "activo" },
    });
    return rutas.reduce((total, ruta) => total + (ruta.costoCobro ?? 0), 0);
  }

  async generarCobrosDelDia(hoy: Date = new Date()): Promise<number> {
    const socios = await this.socioRepo.find({ where: { estatus: "activo" } });
    const periodo = periodoDeFecha(hoy);
    let creados = 0;
    for (const socio of socios) {
      const diasAnticipacion = socio.diasAnticipacionCobro ?? 0;
      if (formatDate(hoy) === fechaGeneracionCobro(periodo, diaAnclaDe(socio.createdAt), diasAnticipacion)) {
        const creado = await this.crearCobroSiNoExiste(socio, periodo);
        if (creado) creados += 1;
      }
    }
    return creados;
  }

  async generarCobro(socioId: number, periodo: string): Promise<CobroSocioPublic> {
    const socio = await this.socioRepo.findOne({ where: { id: socioId } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }
    const creado = await this.crearCobroSiNoExiste(socio, periodo);
    if (!creado) {
      throw new ConflictException("El cobro de ese periodo ya existe");
    }
    return this.toPublic(creado);
  }

  async marcarVencidos(hoy: Date = new Date()): Promise<number> {
    const hoyStr = formatDate(hoy);
    const vencidos = await this.cobroRepo.find({
      where: { estado: "pendiente", fechaVencimiento: LessThan(hoyStr) },
    });
    for (const cobro of vencidos) {
      await this.cobroRepo.update(cobro.id, { estado: "vencido" });
      await this.linkRepo.update({ cobroSocio: { id: cobro.id } }, { estado: "vencido" });
    }
    return vencidos.length;
  }

  async registrarPago(
    cobroId: number,
    input: RegistrarPagoInput,
  ): Promise<CobroSocioPublic> {
    const cobro = await this.cobroRepo.findOne({ where: { id: cobroId } });
    if (!cobro) {
      throw new NotFoundException("El cobro no existe");
    }
    if (cobro.estado === "pagado") {
      throw new BadRequestException("El cobro ya está pagado");
    }

    cobro.estado = "pagado";
    cobro.montoPagado = input.montoPagado;
    cobro.metodoPago = input.metodoPago;
    cobro.fechaPago = input.fechaPago ?? formatDate(new Date());
    cobro.registradoPor = input.registradoPor;
    const saved = await this.cobroRepo.save(cobro);
    await this.linkRepo.update({ cobroSocio: { id: cobro.id } }, { estado: "pagado" });

    return this.toPublic(saved);
  }

  async listar(filtros: ListarCobrosFiltros = {}): Promise<CobroSocioPublic[]> {
    const where: Record<string, unknown> = {};
    if (filtros.socioId !== undefined) where.socio = { id: filtros.socioId };
    if (filtros.periodo !== undefined) where.periodo = filtros.periodo;
    if (filtros.estado !== undefined) where.estado = filtros.estado;

    const cobros = await this.cobroRepo.find({
      where,
      order: { periodo: "DESC" },
    });
    return cobros.map((cobro) => this.toPublic(cobro));
  }

  async obtener(id: number): Promise<CobroSocioPublic> {
    const cobro = await this.cobroRepo.findOne({
      where: { id },
      relations: { socio: true, linkPago: true },
    });
    if (!cobro) {
      throw new NotFoundException("El cobro no existe");
    }
    return this.toPublic(cobro);
  }

  private async crearCobroSiNoExiste(socio: Socio, periodo: string): Promise<CobroSocio | null> {
    const existente = await this.cobroRepo.findOne({
      where: { socio: { id: socio.id }, periodo },
    });
    if (existente) {
      return null;
    }

    const montoCalculado = await this.calcularCobro(socio.id);
    const fechaVencimiento = calcularFechaVencimiento(periodo, diaAnclaDe(socio.createdAt));
    const cobro = this.cobroRepo.create({
      socio: { id: socio.id } as Socio,
      socioId: socio.id,
      periodo,
      montoCalculado,
      fechaVencimiento,
      estado: "pendiente",
      montoPagado: null,
      fechaPago: null,
      metodoPago: null,
      registradoPor: null,
    });
    let saved: CobroSocio;
    try {
      saved = await this.cobroRepo.save(cobro);
    } catch (err) {
      // Idempotencia ante concurrencia: la constraint única (socio_id, periodo)
      // gana la carrera; se trata como "ya existe".
      if (this.isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }

    const link = this.linkRepo.create({
      cobroSocio: { id: saved.id } as CobroSocio,
      cobroSocioId: saved.id,
      url: `${MOCK_LINK_BASE}/${saved.id}`,
      estado: "generado",
      proveedor: "mock",
    });
    await this.linkRepo.save(link);

    return saved;
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }

  private toPublic(cobro: CobroSocio): CobroSocioPublic {
    return {
      id: cobro.id,
      socioId: cobro.socioId,
      periodo: cobro.periodo,
      montoCalculado: cobro.montoCalculado,
      montoPagado: cobro.montoPagado,
      fechaVencimiento: cobro.fechaVencimiento,
      fechaPago: cobro.fechaPago,
      estado: cobro.estado,
      metodoPago: cobro.metodoPago,
      registradoPor: cobro.registradoPor,
      createdAt: cobro.createdAt,
      socio: cobro.socio
        ? {
            id: cobro.socio.id,
            nombre: cobro.socio.nombre,
            apellido: cobro.socio.apellido,
            moneda: cobro.socio.moneda,
          }
        : null,
      linkPago: cobro.linkPago
        ? {
            id: cobro.linkPago.id,
            url: cobro.linkPago.url,
            estado: cobro.linkPago.estado,
            proveedor: cobro.linkPago.proveedor,
          }
        : null,
    };
  }
}