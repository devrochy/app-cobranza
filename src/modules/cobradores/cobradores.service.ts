import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
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
