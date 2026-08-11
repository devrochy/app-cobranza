import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { Socio, SocioEstatus } from "./socio.entity";

export interface CreateSocioInput {
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  moneda: string;
  estatus?: SocioEstatus;
}

export interface SocioPublic {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  moneda: string;
  estatus: SocioEstatus;
  createdAt: Date;
}

@Injectable()
export class SociosService {
  constructor(
    @InjectRepository(Socio)
    private readonly repo: Repository<Socio>,
    private readonly password: PasswordService,
  ) {}

  async create(input: CreateSocioInput): Promise<SocioPublic> {
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
    const socio = this.repo.create({
      usuario: input.usuario,
      passwordHash,
      nombre: input.nombre,
      apellido: input.apellido,
      correo: input.correo,
      telefono: input.telefono,
      codigo: input.codigo,
      moneda: input.moneda,
      estatus: input.estatus ?? "activo",
    });

    let saved: Socio;
    try {
      saved = await this.repo.save(socio);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved);
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }

  private assertNoConflicts(existing: Socio, input: CreateSocioInput): void {
    const conflicts: Array<[string, string]> = [
      ["usuario", input.usuario],
      ["codigo", input.codigo],
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (existing[field as keyof Socio] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private toPublic(socio: Socio): SocioPublic {
    return {
      id: socio.id,
      usuario: socio.usuario,
      nombre: socio.nombre,
      apellido: socio.apellido,
      correo: socio.correo,
      telefono: socio.telefono,
      codigo: socio.codigo,
      moneda: socio.moneda,
      estatus: socio.estatus,
      createdAt: socio.createdAt,
    };
  }
}
