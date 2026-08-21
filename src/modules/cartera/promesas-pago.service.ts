import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "../rutas/ruta.entity";
import { Prestamo } from "./prestamo.entity";
import { PromesaPago, PromesaEstado, PromesaCreador, TipoPromesa } from "./promesa-pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";

export interface RequesterPromesaContext {
  rol: RolUsuario;
  sub: number;
}

export interface TransicionarEstadoInput {
  estado: "cumplida" | "incumplida";
  motivo: string;
}

export interface PromesaPagoPublic {
  id: number;
  prestamoId: number;
  tipo: TipoPromesa;
  fechaPrometida: string;
  valorPrometido: number;
  estado: PromesaEstado;
  creadoPor: PromesaCreador;
  origenConversacionId: number | null;
  origenVisitaId: number | null;
  createdAt: Date;
}

/**
 * HU-34: las promesas/acuerdos (de IA y cobrador) se exponen como entidad
 * auditable vinculada al préstamo. Permite consultar el historial y transicionar
 * el estado (cumplida/incumplida) con registro imborrable en `auditoria_cartera`.
 */
@Injectable()
export class PromesasPagoService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(PromesaPago)
    private readonly promesaRepo: Repository<PromesaPago>,
    @InjectRepository(AuditoriaCartera)
    private readonly auditoriaRepo: Repository<AuditoriaCartera>,
    private readonly dataSource: DataSource,
  ) {}

  async listarPorPrestamo(
    rutaId: number,
    prestamoId: number,
    requester: RequesterPromesaContext,
  ): Promise<PromesaPagoPublic[]> {
    await this.acceder(rutaId, requester);

    const prestamo = await this.prestamoRepo.findOne({
      where: { id: prestamoId, ruta: { id: rutaId } },
    });
    if (!prestamo) {
      throw new NotFoundException("El préstamo no existe en esta ruta");
    }

    const promesas = await this.promesaRepo.find({
      where: { prestamo: { id: prestamoId } },
      order: { createdAt: "DESC" },
    });

    return promesas.map((p) => this.toPublic(p));
  }

  async transicionarEstado(
    rutaId: number,
    promesaId: number,
    input: TransicionarEstadoInput,
    requester: RequesterPromesaContext,
  ): Promise<PromesaPagoPublic> {
    await this.acceder(rutaId, requester);

    const promesa = await this.promesaRepo.findOne({
      where: { id: promesaId, prestamo: { ruta: { id: rutaId } } },
    });
    if (!promesa) {
      throw new NotFoundException("La promesa no existe en esta ruta");
    }
    if (!input.motivo?.trim()) {
      throw new BadRequestException("El motivo es obligatorio");
    }
    if (promesa.estado === input.estado) {
      throw new BadRequestException(`La promesa ya está en estado ${input.estado}`);
    }

    const estadoAnterior = promesa.estado;

    await this.dataSource.transaction(async (manager) => {
      const promesaRepo = manager.getRepository(PromesaPago);
      const auditoriaRepo = manager.getRepository(AuditoriaCartera);

      promesa.estado = input.estado;
      await promesaRepo.save(promesa);

      const fila = auditoriaRepo.create({
        entidad: "promesa",
        entidadId: promesa.id,
        operacion: "editar",
        valoresAntes: { estado: estadoAnterior },
        valoresDespues: { estado: input.estado },
        actorRol: requester.rol,
        actorId: requester.sub,
        motivo: input.motivo,
      });
      await auditoriaRepo.save(fila);
    });

    return this.toPublic(promesa);
  }

  private async acceder(rutaId: number, requester: RequesterPromesaContext): Promise<Ruta> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    return ruta;
  }

  private toPublic(promesa: PromesaPago): PromesaPagoPublic {
    return {
      id: promesa.id,
      prestamoId: promesa.prestamoId,
      tipo: promesa.tipo,
      fechaPrometida: promesa.fechaPrometida,
      valorPrometido: promesa.valorPrometido,
      estado: promesa.estado,
      creadoPor: promesa.creadoPor,
      origenConversacionId: promesa.conversacionId,
      origenVisitaId: promesa.visitaId,
      createdAt: promesa.createdAt,
    };
  }
}