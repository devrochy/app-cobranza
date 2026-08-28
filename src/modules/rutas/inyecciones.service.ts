import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "./ruta.entity";
import { Inyeccion, InyeccionEstado } from "./inyeccion.entity";
import { CajaService, TipoMovimientoCaja } from "./caja.service";

export interface CreateInyeccionInput {
  valor: number;
  comentario: string;
}

export interface RequesterInyeccionContext {
  rol: RolUsuario;
  sub: number;
}

export interface InyeccionPublic {
  id: number;
  rutaId: number;
  valor: number;
  comentario: string;
  fechaHora: Date;
  estado: InyeccionEstado;
}



@Injectable()
export class InyeccionesService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Inyeccion)
    private readonly repo: Repository<Inyeccion>,
    private readonly cajaService: CajaService,
  ) {}

  async crear(
    rutaId: number,
    input: CreateInyeccionInput,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const inyeccion = this.repo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      valor: input.valor,
      comentario: input.comentario,
      estado: "activa",
    });
    const saved = await this.repo.save(inyeccion);
    // Wiring de caja (HU-11 ampliada): una inyección activa aumenta el saldo.
    await this.cajaService.aplicarMovimiento(
      rutaId,
      input.valor,
      TipoMovimientoCaja.INYECCION,
      requester,
      input.comentario,
    );
    return this.toPublic(saved, rutaId);
  }

  async eliminar(
    rutaId: number,
    inyeccionId: number,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const inyeccion = await this.repo.findOne({
      where: { id: inyeccionId, ruta: { id: rutaId } },
    });
    if (!inyeccion) {
      throw new NotFoundException("La inyección no existe");
    }

    // HU-12: soft-delete idempotente. Se conserva el registro y su fecha_hora
    // (trazabilidad, PRD 4.3:274); solo cambia la visibilidad via estado.
    const estabaActiva = inyeccion.estado === "activa";
    inyeccion.estado = "eliminada";
    const saved = await this.repo.save(inyeccion);
    // Wiring de caja (HU-12 ampliada): si la inyección estaba activa, revierte el
    // saldo que su creación aportó.
    if (estabaActiva) {
      await this.cajaService.aplicarMovimiento(
        rutaId,
        -inyeccion.valor,
        TipoMovimientoCaja.INYECCION_ELIMINADA,
        requester,
        inyeccion.comentario,
      );
    }
    return this.toPublic(saved, rutaId);
  }

  async listar(
    rutaId: number,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const inyecciones = await this.repo.find({
      where: { ruta: { id: rutaId }, estado: "activa" },
      order: { fechaHora: "DESC" },
    });
    return inyecciones.map((inyeccion) => this.toPublic(inyeccion, rutaId));
  }

  private toPublic(inyeccion: Inyeccion, rutaId: number): InyeccionPublic {
    return {
      id: inyeccion.id,
      rutaId,
      valor: inyeccion.valor,
      comentario: inyeccion.comentario,
      fechaHora: inyeccion.fechaHora,
      estado: inyeccion.estado,
    };
  }
}
