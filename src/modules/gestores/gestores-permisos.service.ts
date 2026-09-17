import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Gestor } from "./gestor.entity";
import { GESTOR_PERMISOS, GestorPermiso, GestorPermisoNombre } from "./gestor-permiso.entity";

export interface PermisoGestorEstado {
  permiso: GestorPermisoNombre;
  habilitado: boolean;
}

export type MatrizPermisosGestor = Partial<Record<GestorPermisoNombre, boolean>>;

@Injectable()
export class GestoresPermisosService {
  constructor(
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    @InjectRepository(GestorPermiso)
    private readonly permisoRepo: Repository<GestorPermiso>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getMatriz(gestorId: number): Promise<PermisoGestorEstado[]> {
    await this.assertGestorExists(gestorId);

    const filas = await this.permisoRepo.find({
      where: { gestor: { id: gestorId } },
    });
    const habilitados = new Map(filas.map((f) => [f.permiso, f.habilitado]));

    return GESTOR_PERMISOS.map((permiso) => ({
      permiso,
      habilitado: habilitados.get(permiso) ?? false,
    }));
  }

  async setMatriz(
    gestorId: number,
    matriz: MatrizPermisosGestor,
  ): Promise<PermisoGestorEstado[]> {
    await this.assertGestorExists(gestorId);

    const clavesInvalidas = Object.keys(matriz).filter(
      (key) => !(GESTOR_PERMISOS as readonly string[]).includes(key),
    );
    if (clavesInvalidas.length > 0) {
      throw new BadRequestException(
        `Permisos inválidos: ${clavesInvalidas.join(", ")}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.delete(GestorPermiso, { gestor: { id: gestorId } });
      const filas = GESTOR_PERMISOS.map((permiso) => ({
        gestor: { id: gestorId } as Gestor,
        permiso,
        habilitado: matriz[permiso] ?? false,
      }));
      await queryRunner.manager.save(GestorPermiso, filas);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getMatriz(gestorId);
  }

  async assertOwnedByPropietario(gestorId: number, propietarioId: number): Promise<void> {
    const gestor = await this.assertGestorExists(gestorId);
    if (gestor.propietarioId !== propietarioId) {
      throw new ForbiddenException("El gestor no pertenece al propietario");
    }
  }

  async tienePermiso(
    gestorId: number,
    permiso: GestorPermisoNombre,
  ): Promise<boolean> {
    const fila = await this.permisoRepo.findOne({
      where: { gestor: { id: gestorId }, permiso, habilitado: true },
    });
    return fila !== null;
  }

  private async assertGestorExists(gestorId: number): Promise<Gestor> {
    const gestor = await this.gestorRepo.findOne({ where: { id: gestorId } });
    if (!gestor) {
      throw new NotFoundException("El gestor no existe");
    }
    return gestor;
  }
}
