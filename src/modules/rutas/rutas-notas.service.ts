import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "./ruta.entity";
import { RutaNota } from "./ruta-nota.entity";

export interface CrearNotaInput {
  nota: string;
}

export interface EditarNotaInput {
  nota: string;
}

export interface RequesterNotaContext {
  rol: RolUsuario;
  sub: number;
}

export interface RutaNotaPublic {
  id: number;
  rutaId: number;
  nota: string;
  creadoPorRol: string;
  creadoPorId: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class RutasNotasService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(RutaNota)
    private readonly notaRepo: Repository<RutaNota>,
  ) {}

  async crear(
    rutaId: number,
    input: CrearNotaInput,
    requester: RequesterNotaContext,
  ): Promise<RutaNotaPublic> {
    await this.validarRuta(rutaId, requester);

    const nota = this.notaRepo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      nota: input.nota,
      creadoPorRol: requester.rol,
      creadoPorId: requester.sub,
    });
    const saved = await this.notaRepo.save(nota);
    return this.toPublic(saved);
  }

  async listar(rutaId: number, requester: RequesterNotaContext): Promise<RutaNotaPublic[]> {
    await this.validarRuta(rutaId, requester);

    const notas = await this.notaRepo.find({
      where: { ruta: { id: rutaId } },
      order: { createdAt: "DESC" },
    });
    return notas.map((nota) => this.toPublic(nota));
  }

  async editar(
    rutaId: number,
    notaId: number,
    input: EditarNotaInput,
    requester: RequesterNotaContext,
  ): Promise<RutaNotaPublic> {
    await this.validarRuta(rutaId, requester);

    const nota = await this.buscarNota(rutaId, notaId);
    nota.nota = input.nota;
    const saved = await this.notaRepo.save(nota);
    return this.toPublic(saved);
  }

  async eliminar(
    rutaId: number,
    notaId: number,
    requester: RequesterNotaContext,
  ): Promise<{ id: number }> {
    await this.validarRuta(rutaId, requester);

    const nota = await this.buscarNota(rutaId, notaId);
    await this.notaRepo.delete({ id: nota.id });
    return { id: notaId };
  }

  private async validarRuta(rutaId: number, requester: RequesterNotaContext): Promise<void> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
  }

  private async buscarNota(rutaId: number, notaId: number): Promise<RutaNota> {
    const nota = await this.notaRepo.findOne({ where: { id: notaId, ruta: { id: rutaId } } });
    if (!nota) {
      throw new NotFoundException("La nota no existe en esta ruta");
    }
    return nota;
  }

  private toPublic(nota: RutaNota): RutaNotaPublic {
    return {
      id: nota.id,
      rutaId: nota.rutaId,
      nota: nota.nota,
      creadoPorRol: nota.creadoPorRol,
      creadoPorId: nota.creadoPorId,
      createdAt: nota.createdAt,
      updatedAt: nota.updatedAt,
    };
  }
}