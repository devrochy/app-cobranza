import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PROPIETARIO_PERMISOS, PropietarioPermiso, PropietarioPermisoNombre } from "./propietario-permiso.entity";
import { Propietario } from "./propietario.entity";

export interface PermisoEstado {
  permiso: PropietarioPermisoNombre;
  habilitado: boolean;
}

export type MatrizPermisos = Partial<Record<PropietarioPermisoNombre, boolean>>;

@Injectable()
export class PermisosPropietarioService {
  constructor(
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(PropietarioPermiso)
    private readonly permisoRepo: Repository<PropietarioPermiso>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getMatriz(propietarioId: number): Promise<PermisoEstado[]> {
    await this.assertPropietarioExists(propietarioId);

    const filas = await this.permisoRepo.find({
      where: { propietario: { id: propietarioId } },
    });
    const habilitados = new Map(filas.map((f) => [f.permiso, f.habilitado]));

    return PROPIETARIO_PERMISOS.map((permiso) => ({
      permiso,
      habilitado: habilitados.get(permiso) ?? false,
    }));
  }

  async tienePermiso(propietarioId: number, permiso: PropietarioPermisoNombre): Promise<boolean> {
    const fila = await this.permisoRepo.findOne({
      where: { propietario: { id: propietarioId }, permiso, habilitado: true },
    });
    return fila !== null;
  }

  async setMatriz(propietarioId: number, matriz: MatrizPermisos): Promise<PermisoEstado[]> {
    await this.assertPropietarioExists(propietarioId);

    const clavesInvalidas = Object.keys(matriz).filter(
      (key) => !(PROPIETARIO_PERMISOS as readonly string[]).includes(key),
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
      await queryRunner.manager.delete(PropietarioPermiso, { propietario: { id: propietarioId } });
      const filas = PROPIETARIO_PERMISOS.map((permiso) => ({
        propietario: { id: propietarioId } as Propietario,
        permiso,
        habilitado: matriz[permiso] ?? false,
      }));
      await queryRunner.manager.save(PropietarioPermiso, filas);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getMatriz(propietarioId);
  }

  private async assertPropietarioExists(propietarioId: number): Promise<void> {
    const propietario = await this.propietarioRepo.findOne({ where: { id: propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }
  }
}
