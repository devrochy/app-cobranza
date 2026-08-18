import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Ruta, RutaEstatus } from "../rutas/ruta.entity";
import { Socio } from "../socios/socio.entity";
import { Cobrador, CobradorEstatus } from "./cobrador.entity";

export interface CreateCobradorInput {
  socioId: number;
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  estatus?: CobradorEstatus;
}

export interface UpdateCobradorInput {
  nombre?: string;
  apellido?: string;
  correo?: string;
  telefono?: string;
  password?: string;
}

export interface CobradorPublic {
  id: number;
  socioId: number;
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  estatus: CobradorEstatus;
  createdAt: Date;
}

@Injectable()
export class CobradoresService {
  constructor(
    @InjectRepository(Cobrador)
    private readonly repo: Repository<Cobrador>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly password: PasswordService,
  ) {}

  async create(input: CreateCobradorInput): Promise<CobradorPublic> {
    const socio = await this.socioRepo.findOne({ where: { id: input.socioId } });
    if (!socio) {
      throw new NotFoundException("El socio asociado no existe");
    }
    if (socio.estatus === "bloqueado") {
      throw new ConflictException("El socio asociado está bloqueado");
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
    const cobrador = this.repo.create({
      socio: { id: socio.id } as Socio,
      usuario: input.usuario,
      passwordHash,
      nombre: input.nombre,
      apellido: input.apellido,
      correo: input.correo,
      telefono: input.telefono,
      codigo: input.codigo,
      estatus: input.estatus ?? "activo",
    });

    let saved: Cobrador;
    try {
      saved = await this.repo.save(cobrador);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved, input.socioId);
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }

  async listar(socioId?: number): Promise<CobradorPublic[]> {
    const cobradores =
      socioId === undefined
        ? await this.repo.find({ order: { id: "ASC" } })
        : await this.repo.find({
            where: { socio: { id: socioId } },
            order: { id: "ASC" },
          });
    return cobradores.map((c) => this.toPublic(c, c.socioId));
  }

  async update(id: number, input: UpdateCobradorInput): Promise<CobradorPublic> {
    const cobrador = await this.repo.findOne({ where: { id } });
    if (!cobrador) {
      throw new NotFoundException("El cobrador no existe");
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

    const updates: Partial<Cobrador> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.apellido !== undefined) updates.apellido = input.apellido;
    if (input.correo !== undefined) updates.correo = input.correo;
    if (input.telefono !== undefined) updates.telefono = input.telefono;
    if (input.password !== undefined) {
      updates.passwordHash = await this.password.hash(input.password);
    }
    Object.assign(cobrador, updates);

    let saved: Cobrador;
    try {
      saved = await this.repo.save(cobrador);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved, cobrador.socioId);
  }

  async setEstatus(id: number, estatus: CobradorEstatus): Promise<CobradorPublic> {
    const cobrador = await this.dataSource.transaction(async (manager) => {
      const existente = await manager.findOne(Cobrador, { where: { id } });
      if (!existente) {
        throw new NotFoundException("El cobrador no existe");
      }

      // HU-05: al bloquear/activar el cobrador se bloquean/reactivan sus rutas,
      // todo dentro de la misma transacción (rollback si la cascada falla).
      existente.estatus = estatus;
      await manager.save(existente);
      const rutaEstatus: RutaEstatus = estatus === "bloqueado" ? "bloqueado" : "activo";
      await manager.update(
        Ruta,
        { cobrador: { id } },
        { estatus: rutaEstatus },
      );

      return existente;
    });

    return this.toPublic(cobrador, cobrador.socioId);
  }

  private assertUpdateNoConflicts(existing: Cobrador, input: UpdateCobradorInput): void {
    const conflicts: Array<[string, string | undefined]> = [
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (value !== undefined && existing[field as keyof Cobrador] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private assertNoConflicts(existing: Cobrador, input: CreateCobradorInput): void {
    const conflicts: Array<[string, string]> = [
      ["usuario", input.usuario],
      ["codigo", input.codigo],
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (existing[field as keyof Cobrador] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private toPublic(cobrador: Cobrador, socioId: number): CobradorPublic {
    return {
      id: cobrador.id,
      socioId,
      usuario: cobrador.usuario,
      nombre: cobrador.nombre,
      apellido: cobrador.apellido,
      correo: cobrador.correo,
      telefono: cobrador.telefono,
      codigo: cobrador.codigo,
      estatus: cobrador.estatus,
      createdAt: cobrador.createdAt,
    };
  }
}
