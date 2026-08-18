import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "./ruta.entity";
import { Inyeccion, InyeccionEstado } from "./inyeccion.entity";

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

const ACCESO_DENEGADO = "Acceso denegado";

@Injectable()
export class InyeccionesService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Inyeccion)
    private readonly repo: Repository<Inyeccion>,
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
    this.assertOwned(ruta, requester);

    const inyeccion = this.repo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      valor: input.valor,
      comentario: input.comentario,
      estado: "activa",
    });
    const saved = await this.repo.save(inyeccion);
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
    this.assertOwned(ruta, requester);

    const inyeccion = await this.repo.findOne({
      where: { id: inyeccionId, ruta: { id: rutaId } },
    });
    if (!inyeccion) {
      throw new NotFoundException("La inyección no existe");
    }

    // HU-12: soft-delete idempotente. Se conserva el registro y su fecha_hora
    // (trazabilidad, PRD 4.3:274); solo cambia la visibilidad via estado.
    inyeccion.estado = "eliminada";
    const saved = await this.repo.save(inyeccion);
    return this.toPublic(saved, rutaId);
  }

  private assertOwned(ruta: Ruta, requester: RequesterInyeccionContext): void {
    if (requester.rol === "socio" && ruta.socioId !== requester.sub) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
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
