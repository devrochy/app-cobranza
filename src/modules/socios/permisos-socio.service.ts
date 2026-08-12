import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SOCIO_PERMISOS, SocioPermiso, SocioPermisoNombre } from "./socio-permiso.entity";
import { Socio } from "./socio.entity";

export interface PermisoEstado {
  permiso: SocioPermisoNombre;
  habilitado: boolean;
}

export type MatrizPermisos = Partial<Record<SocioPermisoNombre, boolean>>;

@Injectable()
export class PermisosSocioService {
  constructor(
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(SocioPermiso)
    private readonly permisoRepo: Repository<SocioPermiso>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getMatriz(socioId: number): Promise<PermisoEstado[]> {
    await this.assertSocioExists(socioId);

    const filas = await this.permisoRepo.find({
      where: { socio: { id: socioId } },
    });
    const habilitados = new Map(filas.map((f) => [f.permiso, f.habilitado]));

    return SOCIO_PERMISOS.map((permiso) => ({
      permiso,
      habilitado: habilitados.get(permiso) ?? false,
    }));
  }

  async setMatriz(socioId: number, matriz: MatrizPermisos): Promise<PermisoEstado[]> {
    await this.assertSocioExists(socioId);

    const clavesInvalidas = Object.keys(matriz).filter(
      (key) => !(SOCIO_PERMISOS as readonly string[]).includes(key),
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
      await queryRunner.manager.delete(SocioPermiso, { socio: { id: socioId } });
      const filas = SOCIO_PERMISOS.map((permiso) => ({
        socio: { id: socioId } as Socio,
        permiso,
        habilitado: matriz[permiso] ?? false,
      }));
      await queryRunner.manager.save(SocioPermiso, filas);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getMatriz(socioId);
  }

  private async assertSocioExists(socioId: number): Promise<void> {
    const socio = await this.socioRepo.findOne({ where: { id: socioId } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }
  }
}
