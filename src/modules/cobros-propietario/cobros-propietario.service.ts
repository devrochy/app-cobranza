import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { formatDate } from "../../common/date";
import { isUniqueViolation } from "../../common/db-errors";
import { MetodoPago } from "../../domain/metodo-pago";
import { Cartera } from "../carteras/cartera.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { CobroPropietario, CobroPropietarioEstado } from "./cobro-propietario.entity";
import { calcularFechaVencimiento, diaAnclaDe, fechaGeneracionCobro, periodoDeFecha } from "./cobro-fecha";
import { LinkPago, LinkPagoEstado } from "./link-pago.entity";
import { PropietarioMoraService } from "./propietario-mora.service";

export interface RegistrarPagoInput {
  montoPagado: number;
  metodoPago: MetodoPago;
  fechaPago?: string;
  registradoPor: number;
}

export interface CobroPropietarioPublic {
  id: number;
  propietarioId: number;
  periodo: string;
  montoCalculado: number;
  montoPagado: number | null;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: CobroPropietarioEstado;
  metodoPago: MetodoPago | null;
  registradoPor: number | null;
  createdAt: Date;
  propietario?: { id: number; nombre: string; apellido: string; moneda: string } | null;
  linkPago?: { id: number; url: string; estado: LinkPagoEstado; proveedor: string } | null;
}

export interface ListarCobrosFiltros {
  propietarioId?: number;
  periodo?: string;
  estado?: CobroPropietarioEstado;
}

const MOCK_LINK_BASE = "https://pago.mock/cobros-propietario";

/**
 * Cobro mensual a propietarios (HU-60): cálculo = suma del costo_cobro de las carteras
 * activas del propietario (en la moneda del propietario), vencimiento anclado al día de alta,
 * registro de pago con historial y link de pago mock (PRD 6.4).
 */
@Injectable()
export class CobrosPropietarioService {
  constructor(
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CobroPropietario)
    private readonly cobroRepo: Repository<CobroPropietario>,
    @InjectRepository(LinkPago)
    private readonly linkRepo: Repository<LinkPago>,
    private readonly propietarioMoraService: PropietarioMoraService,
  ) {}

  async calcularCobro(propietarioId: number): Promise<number> {
    const carteras = await this.carteraRepo.find({
      where: { propietario: { id: propietarioId }, estatus: "activo" },
    });
    return carteras.reduce((total, cartera) => total + (cartera.costoCobro ?? 0), 0);
  }

  async generarCobrosDelDia(hoy: Date = new Date()): Promise<number> {
    const propietarios = await this.propietarioRepo.find({ where: { estatus: "activo" } });
    const periodo = periodoDeFecha(hoy);
    let creados = 0;
    for (const propietario of propietarios) {
      const diasAnticipacion = propietario.diasAnticipacionCobro ?? 0;
      if (formatDate(hoy) === fechaGeneracionCobro(periodo, diaAnclaDe(propietario.createdAt), diasAnticipacion)) {
        const creado = await this.crearCobroSiNoExiste(propietario, periodo);
        if (creado) creados += 1;
      }
    }
    return creados;
  }

  async generarCobro(propietarioId: number, periodo: string): Promise<CobroPropietarioPublic> {
    const propietario = await this.propietarioRepo.findOne({ where: { id: propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }
    const creado = await this.crearCobroSiNoExiste(propietario, periodo);
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
      await this.linkRepo.update({ cobroPropietario: { id: cobro.id } }, { estado: "vencido" });
    }
    return vencidos.length;
  }

  async registrarPago(
    cobroId: number,
    input: RegistrarPagoInput,
  ): Promise<CobroPropietarioPublic> {
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
    await this.linkRepo.update({ cobroPropietario: { id: cobro.id } }, { estado: "pagado" });

    // HU-61: al registrarse el pago se re-habilita el propietario si ya no queda morosidad.
    await this.propietarioMoraService.habilitarSiSinMorosidad(cobro.propietarioId);

    return this.toPublic(saved);
  }

  async listar(filtros: ListarCobrosFiltros = {}): Promise<CobroPropietarioPublic[]> {
    const where: Record<string, unknown> = {};
    if (filtros.propietarioId !== undefined) where.propietario = { id: filtros.propietarioId };
    if (filtros.periodo !== undefined) where.periodo = filtros.periodo;
    if (filtros.estado !== undefined) where.estado = filtros.estado;

    const cobros = await this.cobroRepo.find({
      where,
      relations: { linkPago: true },
      order: { periodo: "DESC" },
    });
    return cobros.map((cobro) => this.toPublic(cobro));
  }

  async obtener(id: number): Promise<CobroPropietarioPublic> {
    const cobro = await this.cobroRepo.findOne({
      where: { id },
      relations: { propietario: true, linkPago: true },
    });
    if (!cobro) {
      throw new NotFoundException("El cobro no existe");
    }
    return this.toPublic(cobro);
  }

  private async crearCobroSiNoExiste(propietario: Propietario, periodo: string): Promise<CobroPropietario | null> {
    const existente = await this.cobroRepo.findOne({
      where: { propietario: { id: propietario.id }, periodo },
    });
    if (existente) {
      return null;
    }

    const montoCalculado = await this.calcularCobro(propietario.id);
    const fechaVencimiento = calcularFechaVencimiento(periodo, diaAnclaDe(propietario.createdAt));
    const cobro = this.cobroRepo.create({
      propietario: { id: propietario.id } as Propietario,
      propietarioId: propietario.id,
      periodo,
      montoCalculado,
      fechaVencimiento,
      estado: "pendiente",
      montoPagado: null,
      fechaPago: null,
      metodoPago: null,
      registradoPor: null,
    });
    let saved: CobroPropietario;
    try {
      saved = await this.cobroRepo.save(cobro);
    } catch (err) {
      // Idempotencia ante concurrencia: la constraint única (propietario_id, periodo)
      // gana la carrera; se trata como "ya existe".
      if (isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }

    const link = this.linkRepo.create({
      cobroPropietario: { id: saved.id } as CobroPropietario,
      cobroPropietarioId: saved.id,
      url: `${MOCK_LINK_BASE}/${saved.id}`,
      estado: "generado",
      proveedor: "mock",
    });
    await this.linkRepo.save(link);

    return saved;
  }

  private toPublic(cobro: CobroPropietario): CobroPropietarioPublic {
    return {
      id: cobro.id,
      propietarioId: cobro.propietarioId,
      periodo: cobro.periodo,
      montoCalculado: cobro.montoCalculado,
      montoPagado: cobro.montoPagado,
      fechaVencimiento: cobro.fechaVencimiento,
      fechaPago: cobro.fechaPago,
      estado: cobro.estado,
      metodoPago: cobro.metodoPago,
      registradoPor: cobro.registradoPor,
      createdAt: cobro.createdAt,
      propietario: cobro.propietario
        ? {
            id: cobro.propietario.id,
            nombre: cobro.propietario.nombre,
            apellido: cobro.propietario.apellido,
            moneda: cobro.propietario.moneda,
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