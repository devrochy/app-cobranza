import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ACCESO_DENEGADO, assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { Ruta, RutaEstatus } from "./ruta.entity";

export interface CreateRutaInput {
  nombre: string;
  descripcion?: string;
  socioId: number;
  cobradorId: number;
  tipoInteres: number;
  numCuotas: number;
  moneda: string;
}

export interface RequesterContext {
  rol: RolUsuario;
  sub: number;
}

export interface RutaPublic {
  id: number;
  socioId: number;
  cobradorId: number;
  nombre: string;
  descripcion: string | null;
  tipoInteres: number;
  numCuotas: number;
  moneda: string;
  estatus: RutaEstatus;
  createdAt: Date;
}



@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Ruta)
    private readonly repo: Repository<Ruta>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
  ) {}

  async create(input: CreateRutaInput, requester: RequesterContext): Promise<RutaPublic> {
    const socio = await this.socioRepo.findOne({ where: { id: input.socioId } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }

    const cobrador = await this.cobradorRepo.findOne({ where: { id: input.cobradorId } });
    if (!cobrador) {
      throw new NotFoundException("El cobrador no existe");
    }

    if (requester.rol === "socio") {
      if (input.socioId !== requester.sub || cobrador.socioId !== input.socioId) {
        throw new ForbiddenException(ACCESO_DENEGADO);
      }
    }

    if (socio.estatus === "bloqueado") {
      throw new ConflictException("El socio asociado está bloqueado");
    }
    if (cobrador.estatus === "bloqueado") {
      throw new ConflictException("El cobrador asociado está bloqueado");
    }

    const ruta = this.repo.create({
      socio: { id: socio.id } as Socio,
      cobrador: { id: cobrador.id } as Cobrador,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      tipoInteres: input.tipoInteres,
      numCuotas: input.numCuotas,
      moneda: input.moneda,
      estatus: "activo",
    });
    ruta.socioId = input.socioId;
    ruta.cobradorId = input.cobradorId;

    const saved = await this.repo.save(ruta);
    return this.toPublic(saved);
  }

  async aplicarCascada(cobradorId: number, bloqueado: boolean): Promise<void> {
    const estatus: RutaEstatus = bloqueado ? "bloqueado" : "activo";
    await this.repo.update({ cobrador: { id: cobradorId } }, { estatus });
  }

  async actualizarInformacion(
    id: number,
    input: { nombre: string; descripcion?: string | null },
    requester: RequesterContext,
  ): Promise<RutaPublic> {
    const ruta = await this.repo.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    // HU-09: solo metadata (nombre/descripción). La configuración operativa
    // (cobrador, tipoInteres, numCuotas, moneda, estatus) queda intacta.
    // descripcion: null limpia el valor (permitido por la API).
    ruta.nombre = input.nombre;
    if (input.descripcion !== undefined) {
      ruta.descripcion = input.descripcion;
    }
    const saved = await this.repo.save(ruta);
    return this.toPublic(saved);
  }

  async setEstatus(
    id: number,
    estatus: RutaEstatus,
    requester: RequesterContext,
  ): Promise<RutaPublic> {
    const ruta = await this.repo.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    // Reactivación manual intencional: puede activar una ruta cuyo cobrador
    // esté bloqueado (escape hatch decidido con el usuario en HU-08); el
    // invariante de cascada lo re-aplica al cambiar el estatus del cobrador.
    ruta.estatus = estatus;
    const saved = await this.repo.save(ruta);
    return this.toPublic(saved);
  }

  async reasignarCobrador(
    id: number,
    nuevoCobradorId: number,
    requester: RequesterContext,
  ): Promise<RutaPublic> {
    const ruta = await this.repo.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cobrador = await this.cobradorRepo.findOne({ where: { id: nuevoCobradorId } });
    if (!cobrador) {
      throw new NotFoundException("El cobrador no existe");
    }
    if (cobrador.socioId !== ruta.socioId) {
      throw new ConflictException("El cobrador no pertenece al socio de la ruta");
    }
    if (cobrador.estatus === "bloqueado") {
      throw new ConflictException("El cobrador está bloqueado");
    }

    ruta.cobrador = { id: cobrador.id } as Cobrador;
    ruta.cobradorId = cobrador.id;
    ruta.estatus = "activo";
    const saved = await this.repo.save(ruta);
    return this.toPublic(saved);
  }

  async actualizarConfiguracion(
    id: number,
    input: { tipoInteres?: number; numCuotas?: number },
    requester: RequesterContext,
  ): Promise<RutaPublic> {
    if (input.tipoInteres === undefined && input.numCuotas === undefined) {
      throw new BadRequestException("No hay campos de configuración para actualizar");
    }

    const ruta = await this.repo.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    // 9a: solo configuración de default (tipoInteres/numCuotas). La moneda NO es
    // editable (decisión) y la metadata (nombre/descripción) va por otro endpoint.
    // El cambio solo afecta préstamos futuros (HU-14); no se recalculan cuotas.
    if (input.tipoInteres !== undefined) {
      ruta.tipoInteres = input.tipoInteres;
    }
    if (input.numCuotas !== undefined) {
      ruta.numCuotas = input.numCuotas;
    }
    const saved = await this.repo.save(ruta);
    return this.toPublic(saved);
  }

  protected toPublic(ruta: Ruta): RutaPublic {
    return {
      id: ruta.id,
      socioId: ruta.socioId,
      cobradorId: ruta.cobradorId,
      nombre: ruta.nombre,
      descripcion: ruta.descripcion,
      tipoInteres: ruta.tipoInteres,
      numCuotas: ruta.numCuotas,
      moneda: ruta.moneda,
      estatus: ruta.estatus,
      createdAt: ruta.createdAt,
    };
  }
}
