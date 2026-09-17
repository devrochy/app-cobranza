import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { isUniqueViolation } from "../../common/db-errors";
import { PasswordService } from "../security/password.service";
import { Cartera, CarteraEstatus } from "../carteras/cartera.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor, GestorEstatus } from "./gestor.entity";

export interface CreateGestorInput {
  propietarioId: number;
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  estatus?: GestorEstatus;
}

export interface UpdateGestorInput {
  nombre?: string;
  apellido?: string;
  correo?: string;
  telefono?: string;
  password?: string;
}

export interface GestorPublic {
  id: number;
  propietarioId: number;
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  estatus: GestorEstatus;
  createdAt: Date;
}

@Injectable()
export class GestoresService {
  constructor(
    @InjectRepository(Gestor)
    private readonly repo: Repository<Gestor>,
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly password: PasswordService,
  ) {}

  async create(input: CreateGestorInput): Promise<GestorPublic> {
    const propietario = await this.propietarioRepo.findOne({ where: { id: input.propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario asociado no existe");
    }
    if (propietario.estatus === "bloqueado") {
      throw new ConflictException("El propietario asociado está bloqueado");
    }

    const existing = await this.repo.findOne({
      where: [
        { usuario: input.usuario },
        { codigo: input.codigo },
        { correo: input.correo },
        { telefono: input.telefono },
      ],
    });

    if (existing) {
      this.assertNoConflicts(existing, input);
    }

    const passwordHash = await this.password.hash(input.password);
    const gestor = this.repo.create({
      propietario: { id: propietario.id } as Propietario,
      usuario: input.usuario,
      passwordHash,
      nombre: input.nombre,
      apellido: input.apellido,
      correo: input.correo,
      telefono: input.telefono,
      codigo: input.codigo,
      estatus: input.estatus ?? "activo",
    });

    let saved: Gestor;
    try {
      saved = await this.repo.save(gestor);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved, input.propietarioId);
  }

  async listar(propietarioId?: number): Promise<GestorPublic[]> {
    const gestores =
      propietarioId === undefined
        ? await this.repo.find({ order: { id: "ASC" } })
        : await this.repo.find({
            where: { propietario: { id: propietarioId } },
            order: { id: "ASC" },
          });
    return gestores.map((c) => this.toPublic(c, c.propietarioId));
  }

  async update(id: number, input: UpdateGestorInput): Promise<GestorPublic> {
    const gestor = await this.repo.findOne({ where: { id } });
    if (!gestor) {
      throw new NotFoundException("El gestor no existe");
    }

    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException("No hay campos para actualizar");
    }

    if (input.correo !== undefined || input.telefono !== undefined) {
      const existing = await this.repo.findOne({
        where: [
          ...(input.correo !== undefined ? [{ correo: input.correo }] : []),
          ...(input.telefono !== undefined ? [{ telefono: input.telefono }] : []),
        ],
      });
      if (existing && existing.id !== id) {
        this.assertUpdateNoConflicts(existing, input);
      }
    }

    const updates: Partial<Gestor> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.apellido !== undefined) updates.apellido = input.apellido;
    if (input.correo !== undefined) updates.correo = input.correo;
    if (input.telefono !== undefined) updates.telefono = input.telefono;
    if (input.password !== undefined) {
      updates.passwordHash = await this.password.hash(input.password);
    }
    Object.assign(gestor, updates);

    let saved: Gestor;
    try {
      saved = await this.repo.save(gestor);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved, gestor.propietarioId);
  }

  async setEstatus(id: number, estatus: GestorEstatus): Promise<GestorPublic> {
    const gestor = await this.dataSource.transaction(async (manager) => {
      const existente = await manager.findOne(Gestor, { where: { id } });
      if (!existente) {
        throw new NotFoundException("El gestor no existe");
      }

      // HU-05: al bloquear/activar el gestor se bloquean/reactivan sus carteras,
      // todo dentro de la misma transacción (rollback si la cascada falla).
      existente.estatus = estatus;
      await manager.save(existente);
      const carteraEstatus: CarteraEstatus = estatus === "bloqueado" ? "bloqueado" : "activo";
      await manager.update(
        Cartera,
        { gestor: { id } },
        { estatus: carteraEstatus },
      );

      return existente;
    });

    return this.toPublic(gestor, gestor.propietarioId);
  }

  private assertUpdateNoConflicts(existing: Gestor, input: UpdateGestorInput): void {
    const conflicts: Array<[string, string | undefined]> = [
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (value !== undefined && existing[field as keyof Gestor] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private assertNoConflicts(existing: Gestor, input: CreateGestorInput): void {
    const conflicts: Array<[string, string]> = [
      ["usuario", input.usuario],
      ["codigo", input.codigo],
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (existing[field as keyof Gestor] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private toPublic(gestor: Gestor, propietarioId: number): GestorPublic {
    return {
      id: gestor.id,
      propietarioId,
      usuario: gestor.usuario,
      nombre: gestor.nombre,
      apellido: gestor.apellido,
      correo: gestor.correo,
      telefono: gestor.telefono,
      codigo: gestor.codigo,
      estatus: gestor.estatus,
      createdAt: gestor.createdAt,
    };
  }
}
