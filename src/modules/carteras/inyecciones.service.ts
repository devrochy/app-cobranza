import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Cartera } from "./cartera.entity";
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
  carteraId: number;
  valor: number;
  comentario: string;
  fechaHora: Date;
  estado: InyeccionEstado;
}



@Injectable()
export class InyeccionesService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Inyeccion)
    private readonly repo: Repository<Inyeccion>,
    private readonly cajaService: CajaService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(
    carteraId: number,
    input: CreateInyeccionInput,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const inyeccion = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Inyeccion);
      const nueva = repo.create({
        cartera: { id: carteraId } as Cartera,
        carteraId,
        valor: input.valor,
        comentario: input.comentario,
        estado: "activa",
      });
      const saved = await repo.save(nueva);
      // Wiring de caja (HU-11 ampliada): una inyección activa aumenta el saldo.
      await this.cajaService.aplicarMovimiento(
        carteraId,
        input.valor,
        TipoMovimientoCaja.INYECCION,
        requester,
        input.comentario,
        manager,
      );
      return saved;
    });
    return this.toPublic(inyeccion, carteraId);
  }

  async eliminar(
    carteraId: number,
    inyeccionId: number,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const inyeccion = await this.repo.findOne({
      where: { id: inyeccionId, cartera: { id: carteraId } },
    });
    if (!inyeccion) {
      throw new NotFoundException("La inyección no existe");
    }

    // HU-12: soft-delete idempotente. Se conserva el registro y su fecha_hora
    // (trazabilidad, PRD 4.3:274); solo cambia la visibilidad via estado.
    if (inyeccion.estado === "eliminada") {
      return this.toPublic(inyeccion, carteraId);
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Inyeccion);
      // UPDATE condicional: solo la primera eliminación revierte la caja.
      const resultado = await repo.update(
        { id: inyeccionId, cartera: { id: carteraId }, estado: "activa" },
        { estado: "eliminada" },
      );
      if (resultado.affected === 0) {
        return;
      }
      await this.cajaService.aplicarMovimiento(
        carteraId,
        -inyeccion.valor,
        TipoMovimientoCaja.INYECCION_ELIMINADA,
        requester,
        inyeccion.comentario,
        manager,
      );
    });

    inyeccion.estado = "eliminada";
    return this.toPublic(inyeccion, carteraId);
  }

  async listar(
    carteraId: number,
    requester: RequesterInyeccionContext,
  ): Promise<InyeccionPublic[]> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const inyecciones = await this.repo.find({
      where: { cartera: { id: carteraId }, estado: "activa" },
      order: { fechaHora: "DESC" },
    });
    return inyecciones.map((inyeccion) => this.toPublic(inyeccion, carteraId));
  }

  private toPublic(inyeccion: Inyeccion, carteraId: number): InyeccionPublic {
    return {
      id: inyeccion.id,
      carteraId,
      valor: inyeccion.valor,
      comentario: inyeccion.comentario,
      fechaHora: inyeccion.fechaHora,
      estado: inyeccion.estado,
    };
  }
}
