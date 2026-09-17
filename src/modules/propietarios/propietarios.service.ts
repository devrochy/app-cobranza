import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { isUniqueViolation } from "../../common/db-errors";
import { PasswordService } from "../security/password.service";
import { RolUsuario } from "../auth/auth.service";
import { Gestor } from "../gestores/gestor.entity";
import { Cartera, CarteraEstatus } from "../carteras/cartera.entity";
import { Propietario, PropietarioEstatus } from "./propietario.entity";

export interface CreatePropietarioInput {
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  codigo: string;
  moneda: string;
  estatus?: PropietarioEstatus;
}

export interface UpdatePropietarioInput {
  nombre?: string;
  apellido?: string;
  correo?: string;
  telefono?: string;
  password?: string;
}

export interface ActualizarConfiguracionPropietarioInput {
  pais?: string | null;
  nombreOficinaCobro?: string | null;
  diasToleranciaCobro?: number;
  diasAnticipacionCobro?: number;
}

export interface ListarPropietariosFiltros {
  busqueda?: string;
  estatus?: PropietarioEstatus;
}

export interface RequesterPropietarioContext {
  rol: RolUsuario;
  sub: number;
}

export interface PropietarioPublic {
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
  estatus: PropietarioEstatus;
  createdAt: Date;
}

@Injectable()
export class PropietariosService {
  constructor(
    @InjectRepository(Propietario)
    private readonly repo: Repository<Propietario>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly password: PasswordService,
  ) {}

  async create(input: CreatePropietarioInput): Promise<PropietarioPublic> {
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
    const propietario = this.repo.create({
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

    let saved: Propietario;
    try {
      saved = await this.repo.save(propietario);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved);
  }

  private cleanNullable(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  async update(id: number, input: UpdatePropietarioInput): Promise<PropietarioPublic> {
    const propietario = await this.repo.findOne({ where: { id } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
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

    const updates: Partial<Propietario> = {};
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.apellido !== undefined) updates.apellido = input.apellido;
    if (input.correo !== undefined) updates.correo = input.correo;
    if (input.telefono !== undefined) updates.telefono = input.telefono;
    if (input.password !== undefined) {
      updates.passwordHash = await this.password.hash(input.password);
    }
    Object.assign(propietario, updates);

    let saved: Propietario;
    try {
      saved = await this.repo.save(propietario);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("Algún campo único ya está registrado");
      }
      throw err;
    }
    return this.toPublic(saved);
  }

  async obtener(id: number): Promise<PropietarioPublic> {
    const propietario = await this.repo.findOne({ where: { id } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }
    return this.toPublic(propietario);
  }

  async listar(
    filtros: ListarPropietariosFiltros = {},
    requester?: { rol: RolUsuario; sub: number },
  ): Promise<PropietarioPublic[]> {
    const qb = this.repo.createQueryBuilder("propietario");
    if (requester?.rol === "propietario") {
      qb.andWhere("propietario.id = :propietarioId", { propietarioId: requester.sub });
    }
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      qb.andWhere(
        "(propietario.usuario ILIKE :termino OR propietario.nombre ILIKE :termino OR propietario.apellido ILIKE :termino OR propietario.correo ILIKE :termino OR propietario.codigo ILIKE :termino OR propietario.telefono ILIKE :termino)",
        { termino: `%${busqueda}%` },
      );
    }
    if (filtros.estatus) {
      qb.andWhere("propietario.estatus = :estatus", { estatus: filtros.estatus });
    }
    qb.orderBy("propietario.id", "ASC");
    const propietarios = await qb.getMany();
    return propietarios.map((propietario) => this.toPublic(propietario));
  }

  async actualizarConfiguracion(
    id: number,
    input: ActualizarConfiguracionPropietarioInput,
    requester: RequesterPropietarioContext,
  ): Promise<PropietarioPublic> {
    // HU-62: un propietario con permiso solo puede configurar su propio propietario.
    if (requester.rol === "propietario" && requester.sub !== id) {
      throw new ForbiddenException("No puedes configurar otro propietario");
    }

    const propietario = await this.repo.findOne({ where: { id } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }

    const campos = [input.pais, input.nombreOficinaCobro, input.diasToleranciaCobro, input.diasAnticipacionCobro];
    if (campos.every((value) => value === undefined)) {
      throw new BadRequestException("No hay campos de configuración para actualizar");
    }

    if (input.pais !== undefined) propietario.pais = this.cleanNullable(input.pais);
    if (input.nombreOficinaCobro !== undefined) propietario.nombreOficinaCobro = this.cleanNullable(input.nombreOficinaCobro);
    if (input.diasToleranciaCobro !== undefined) propietario.diasToleranciaCobro = input.diasToleranciaCobro;
    if (input.diasAnticipacionCobro !== undefined) propietario.diasAnticipacionCobro = input.diasAnticipacionCobro;

    const saved = await this.repo.save(propietario);
    return this.toPublic(saved);
  }

  async setEstatus(id: number, estatus: PropietarioEstatus): Promise<PropietarioPublic> {
    const propietario = await this.dataSource.transaction(async (manager) => {
      const existente = await manager.findOne(Propietario, { where: { id } });
      if (!existente) {
        throw new NotFoundException("El propietario no existe");
      }

      // HU-05/HU-61: al bloquear/activar un propietario se aplica la cascada a sus
      // gestores y a las carteras de estos, todo dentro de la misma transacción.
      existente.estatus = estatus;
      await manager.save(existente);

      const gestores = await manager.find(Gestor, {
        where: { propietario: { id } },
      });
      const carteraEstatus: CarteraEstatus = estatus === "bloqueado" ? "bloqueado" : "activo";
      for (const gestor of gestores) {
        gestor.estatus = estatus;
        await manager.save(gestor);
        await manager.update(
          Cartera,
          { gestor: { id: gestor.id } },
          { estatus: carteraEstatus },
        );
      }

      return existente;
    });

    return this.toPublic(propietario);
  }

  private assertUpdateNoConflicts(existing: Propietario, input: UpdatePropietarioInput): void {
    const conflicts: Array<[string, string | undefined]> = [
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (value !== undefined && existing[field as keyof Propietario] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private assertNoConflicts(existing: Propietario, input: CreatePropietarioInput): void {
    const conflicts: Array<[string, string]> = [
      ["usuario", input.usuario],
      ["codigo", input.codigo],
      ["correo", input.correo],
      ["telefono", input.telefono],
    ];
    for (const [field, value] of conflicts) {
      if (existing[field as keyof Propietario] === value) {
        throw new ConflictException(`El campo '${field}' ya está registrado`);
      }
    }
  }

  private toPublic(propietario: Propietario): PropietarioPublic {
    return {
      id: propietario.id,
      usuario: propietario.usuario,
      nombre: propietario.nombre,
      apellido: propietario.apellido,
      correo: propietario.correo,
      telefono: propietario.telefono,
      codigo: propietario.codigo,
      moneda: propietario.moneda,
      pais: propietario.pais,
      nombreOficinaCobro: propietario.nombreOficinaCobro,
      diasToleranciaCobro: propietario.diasToleranciaCobro,
      diasAnticipacionCobro: propietario.diasAnticipacionCobro,
      estatus: propietario.estatus,
      createdAt: propietario.createdAt,
    };
  }
}
