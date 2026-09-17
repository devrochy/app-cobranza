import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Cartera } from "./cartera.entity";
import { CarteraNota } from "./cartera-nota.entity";

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

export interface CarteraNotaPublic {
  id: number;
  carteraId: number;
  nota: string;
  creadoPorRol: string;
  creadoPorId: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CarterasNotasService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(CarteraNota)
    private readonly notaRepo: Repository<CarteraNota>,
  ) {}

  async crear(
    carteraId: number,
    input: CrearNotaInput,
    requester: RequesterNotaContext,
  ): Promise<CarteraNotaPublic> {
    await this.validarCartera(carteraId, requester);

    const nota = this.notaRepo.create({
      cartera: { id: carteraId } as Cartera,
      carteraId,
      nota: input.nota,
      creadoPorRol: requester.rol,
      creadoPorId: requester.sub,
    });
    const saved = await this.notaRepo.save(nota);
    return this.toPublic(saved);
  }

  async listar(carteraId: number, requester: RequesterNotaContext): Promise<CarteraNotaPublic[]> {
    await this.validarCartera(carteraId, requester);

    const notas = await this.notaRepo.find({
      where: { cartera: { id: carteraId } },
      order: { createdAt: "DESC" },
    });
    return notas.map((nota) => this.toPublic(nota));
  }

  async editar(
    carteraId: number,
    notaId: number,
    input: EditarNotaInput,
    requester: RequesterNotaContext,
  ): Promise<CarteraNotaPublic> {
    await this.validarCartera(carteraId, requester);

    const nota = await this.buscarNota(carteraId, notaId);
    nota.nota = input.nota;
    const saved = await this.notaRepo.save(nota);
    return this.toPublic(saved);
  }

  async eliminar(
    carteraId: number,
    notaId: number,
    requester: RequesterNotaContext,
  ): Promise<{ id: number }> {
    await this.validarCartera(carteraId, requester);

    const nota = await this.buscarNota(carteraId, notaId);
    await this.notaRepo.delete({ id: nota.id });
    return { id: notaId };
  }

  private async validarCartera(carteraId: number, requester: RequesterNotaContext): Promise<void> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);
  }

  private async buscarNota(carteraId: number, notaId: number): Promise<CarteraNota> {
    const nota = await this.notaRepo.findOne({ where: { id: notaId, cartera: { id: carteraId } } });
    if (!nota) {
      throw new NotFoundException("La nota no existe en esta cartera");
    }
    return nota;
  }

  private toPublic(nota: CarteraNota): CarteraNotaPublic {
    return {
      id: nota.id,
      carteraId: nota.carteraId,
      nota: nota.nota,
      creadoPorRol: nota.creadoPorRol,
      creadoPorId: nota.creadoPorId,
      createdAt: nota.createdAt,
      updatedAt: nota.updatedAt,
    };
  }
}