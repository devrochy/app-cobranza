import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { RolUsuario } from "../auth/auth.service";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Ruta, RutaEstatus } from "../rutas/ruta.entity";
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

export interface UpdateSocioInput {
  nombre?: string;
  apellido?: string;
  correo?: string;
  telefono?: string;
  password?: string;
}

export interface ActualizarConfiguracionSocioInput {
  pais?: string | null;
  nombreOficinaCobro?: string | null;
  diasToleranciaCobro?: number;
  diasAnticipacionCobro?: number;
}

export interface ListarSociosFiltros {
  busqueda?: string;
  estatus?: SocioEstatus;
}

export interface RequesterSocioContext {
  rol: RolUsuario;
  sub: number;
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
  pais: string | null;
  nombreOficinaCobro: string | null;
  diasToleranciaCobro: number;
  diasAnticipacionCobro: number;
  estatus: SocioEstatus;
  createdAt: Date;
}

@Injectable()
export class SociosService {
  constructor(
    @InjectRepository(Socio)
    private readonly repo: Repository<Socio>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

  private cleanNullable(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  async update(id: number, input: UpdateSocioInput): Promise<SocioPublic> {
    const socio = await this.repo.findOne({ where: { id } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
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

    const updates: Partial<Socio> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.apellido !== undefined) updates.apellido = input.apellido;
    if (input.correo !== undefined) updates.correo = input.correo;
    if (input.telefono !== undefined) updates.telefono = input.telefono;
    if (input.password !== undefined) {
      updates.passwordHash = await this.password.hash(input.password);
    }
    Object.assign(socio, updates);

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

  async obtener(id: number): Promise<SocioPublic> {
    const socio = await this.repo.findOne({ where: { id } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }
    return this.toPublic(socio);
  }

  async listar(filtros: ListarSociosFiltros = {}): Promise<SocioPublic[]> {
    const qb = this.repo.createQueryBuilder("socio");
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      qb.andWhere(
        "(socio.usuario ILIKE :termino OR socio.nombre ILIKE :termino OR socio.apellido ILIKE :termino OR socio.correo ILIKE :termino OR socio.codigo ILIKE :termino OR socio.telefono ILIKE :termino)",
        { termino: `%${busqueda}%` },
      );
    }
    if (filtros.estatus) {
      qb.andWhere("socio.estatus = :estatus", { estatus: filtros.estatus });
    }
    qb.orderBy("socio.id", "ASC");
    const socios = await qb.getMany();
    return socios.map((socio) => this.toPublic(socio));
  }

  async actualizarConfiguracion(
    id: number,
    input: ActualizarConfiguracionSocioInput,
    requester: RequesterSocioContext,
  ): Promise<SocioPublic> {
    // HU-62: un socio con permiso solo puede configurar su propio socio.
    if (requester.rol === "socio" && requester.sub !== id) {
      throw new ForbiddenException("No puedes configurar otro socio");
    }

    const socio = await this.repo.findOne({ where: { id } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }

    const campos = [input.pais, input.nombreOficinaCobro, input.diasToleranciaCobro, input.diasAnticipacionCobro];
    if (campos.every((value) => value === undefined)) {
      throw new BadRequestException("No hay campos de configuración para actualizar");
    }

    if (input.pais !== undefined) socio.pais = this.cleanNullable(input.pais);
    if (input.nombreOficinaCobro !== undefined) socio.nombreOficinaCobro = this.cleanNullable(input.nombreOficinaCobro);
    if (input.diasToleranciaCobro !== undefined) socio.diasToleranciaCobro = input.diasToleranciaCobro;
    if (input.diasAnticipacionCobro !== undefined) socio.diasAnticipacionCobro = input.diasAnticipacionCobro;

    const saved = await this.repo.save(socio);
    return this.toPublic(saved);
  }

  async setEstatus(id: number, estatus: SocioEstatus): Promise<SocioPublic> {
    const socio = await this.dataSource.transaction(async (manager) => {
      const existente = await manager.findOne(Socio, { where: { id } });
      if (!existente) {
        throw new NotFoundException("El socio no existe");
      }

      // HU-05/HU-61: al bloquear/activar un socio se aplica la cascada a sus
      // cobradores y a las rutas de estos, todo dentro de la misma transacción.
      existente.estatus = estatus;
      await manager.save(existente);

      const cobradores = await manager.find(Cobrador, {
        where: { socio: { id } },
      });
      const rutaEstatus: RutaEstatus = estatus === "bloqueado" ? "bloqueado" : "activo";
      for (const cobrador of cobradores) {
        cobrador.estatus = estatus;
        await manager.save(cobrador);
        await manager.update(
          Ruta,
          { cobrador: { id: cobrador.id } },
          { estatus: rutaEstatus },
        );
      }

      return existente;
    });

    return this.toPublic(socio);
  }

  private assertUpdateNoConflicts(existing: Socio, input: UpdateSocioInput): void {
    const conflicts: Array<[string, string | undefined]> = [
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (value !== undefined && existing[field as keyof Socio] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
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
      pais: socio.pais,
      nombreOficinaCobro: socio.nombreOficinaCobro,
      diasToleranciaCobro: socio.diasToleranciaCobro,
      diasAnticipacionCobro: socio.diasAnticipacionCobro,
      estatus: socio.estatus,
      createdAt: socio.createdAt,
    };
  }
}
