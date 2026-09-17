import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ACCESO_DENEGADO, assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Cartera, CarteraEstatus } from "./cartera.entity";
import { CajaService } from "./caja.service";

export interface CreateCarteraInput {
  nombre: string;
  descripcion?: string;
  propietarioId: number;
  gestorId: number;
  tipoInteres: number;
  numCuotas: number;
  moneda: string;
  saldoInicial: number;
  costoCobro: number;
}

export interface RequesterContext {
  rol: RolUsuario;
  sub: number;
}

export interface ListarCarterasFiltros {
  busqueda?: string;
  estatus?: CarteraEstatus;
}

export interface CarteraPublic {
  id: number;
  propietarioId: number;
  gestorId: number;
  nombre: string;
  descripcion: string | null;
  tipoInteres: number;
  numCuotas: number;
  moneda: string;
  costoCobro: number;
  estatus: CarteraEstatus;
  createdAt: Date;
}



@Injectable()
export class CarterasService {
  constructor(
    @InjectRepository(Cartera)
    private readonly repo: Repository<Cartera>,
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
  ) {}

  async create(input: CreateCarteraInput, requester: RequesterContext): Promise<CarteraPublic> {
    const propietario = await this.propietarioRepo.findOne({ where: { id: input.propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }

    const gestor = await this.gestorRepo.findOne({ where: { id: input.gestorId } });
    if (!gestor) {
      throw new NotFoundException("El gestor no existe");
    }

    if (requester.rol === "propietario") {
      if (input.propietarioId !== requester.sub || gestor.propietarioId !== input.propietarioId) {
        throw new ForbiddenException(ACCESO_DENEGADO);
      }
    }

    if (propietario.estatus === "bloqueado") {
      throw new ConflictException("El propietario asociado está bloqueado");
    }
    if (gestor.estatus === "bloqueado") {
      throw new ConflictException("El gestor asociado está bloqueado");
    }

    const cartera = this.repo.create({
      propietario: { id: propietario.id } as Propietario,
      gestor: { id: gestor.id } as Gestor,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      tipoInteres: input.tipoInteres,
      numCuotas: input.numCuotas,
      moneda: input.moneda,
      costoCobro: input.costoCobro,
      estatus: "activo",
    });
    cartera.propietarioId = input.propietarioId;
    cartera.gestorId = input.gestorId;

    // HU-08 ampliada: la cartera y su caja (saldo inicial obligatorio) se crean en
    // la misma transacción para no dejar una cartera sin caja.
    const saved = await this.dataSource.transaction(async (manager) => {
      const savedCartera = await manager.save(cartera);
      await this.cajaService.crearCaja(savedCartera.id, input.saldoInicial, manager);
      return savedCartera;
    });
    return this.toPublic(saved);
  }

  async actualizarInformacion(
    id: number,
    input: { nombre: string; descripcion?: string | null },
    requester: RequesterContext,
  ): Promise<CarteraPublic> {
    const cartera = await this.repo.findOne({ where: { id } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    // HU-09: solo metadata (nombre/descripción). La configuración operativa
    // (gestor, tipoInteres, numCuotas, moneda, estatus) queda intacta.
    // descripcion: null limpia el valor (permitido por la API).
    cartera.nombre = input.nombre;
    if (input.descripcion !== undefined) {
      cartera.descripcion = input.descripcion;
    }
    const saved = await this.repo.save(cartera);
    return this.toPublic(saved);
  }

  async setEstatus(
    id: number,
    estatus: CarteraEstatus,
    requester: RequesterContext,
  ): Promise<CarteraPublic> {
    const cartera = await this.repo.findOne({ where: { id } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    // Reactivación manual intencional: puede activar una cartera cuyo gestor
    // esté bloqueado (escape hatch decidido con el usuario en HU-08); el
    // invariante de cascada lo re-aplica al cambiar el estatus del gestor.
    cartera.estatus = estatus;
    const saved = await this.repo.save(cartera);
    return this.toPublic(saved);
  }

  async reasignarGestor(
    id: number,
    nuevoGestorId: number,
    requester: RequesterContext,
  ): Promise<CarteraPublic> {
    const cartera = await this.repo.findOne({ where: { id } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const gestor = await this.gestorRepo.findOne({ where: { id: nuevoGestorId } });
    if (!gestor) {
      throw new NotFoundException("El gestor no existe");
    }
    if (gestor.propietarioId !== cartera.propietarioId) {
      throw new ConflictException("El gestor no pertenece al propietario de la cartera");
    }
    if (gestor.estatus === "bloqueado") {
      throw new ConflictException("El gestor está bloqueado");
    }

    cartera.gestor = { id: gestor.id } as Gestor;
    cartera.gestorId = gestor.id;
    cartera.estatus = "activo";
    const saved = await this.repo.save(cartera);
    return this.toPublic(saved);
  }

  async actualizarConfiguracion(
    id: number,
    input: { tipoInteres?: number; numCuotas?: number },
    requester: RequesterContext,
  ): Promise<CarteraPublic> {
    if (input.tipoInteres === undefined && input.numCuotas === undefined) {
      throw new BadRequestException("No hay campos de configuración para actualizar");
    }

    const cartera = await this.repo.findOne({ where: { id } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    // 9a: solo configuración de default (tipoInteres/numCuotas). La moneda NO es
    // editable (decisión) y la metadata (nombre/descripción) va por otro endpoint.
    // El cambio solo afecta préstamos futuros (HU-14); no se recalculan cuotas.
    if (input.tipoInteres !== undefined) {
      cartera.tipoInteres = input.tipoInteres;
    }
    if (input.numCuotas !== undefined) {
      cartera.numCuotas = input.numCuotas;
    }
    const saved = await this.repo.save(cartera);
    return this.toPublic(saved);
  }

  async listar(
    filtros: ListarCarterasFiltros = {},
    requester?: RequesterContext,
  ): Promise<CarteraPublic[]> {
    const qb = this.repo.createQueryBuilder("cartera");
    if (requester?.rol === "propietario") {
      qb.andWhere("cartera.propietario_id = :propietarioId", { propietarioId: requester.sub });
    }
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      qb.andWhere(
        "(cartera.nombre ILIKE :termino OR cartera.descripcion ILIKE :termino)",
        { termino: `%${busqueda}%` },
      );
    }
    if (filtros.estatus) {
      qb.andWhere("cartera.estatus = :estatus", { estatus: filtros.estatus });
    }
    qb.orderBy("cartera.id", "ASC");
    const carteras = await qb.getMany();
    return carteras.map((cartera) => this.toPublic(cartera));
  }

  protected toPublic(cartera: Cartera): CarteraPublic {
    return {
      id: cartera.id,
      propietarioId: cartera.propietarioId,
      gestorId: cartera.gestorId,
      nombre: cartera.nombre,
      descripcion: cartera.descripcion,
      tipoInteres: cartera.tipoInteres,
      numCuotas: cartera.numCuotas,
      moneda: cartera.moneda,
      costoCobro: cartera.costoCobro,
      estatus: cartera.estatus,
      createdAt: cartera.createdAt,
    };
  }
}
