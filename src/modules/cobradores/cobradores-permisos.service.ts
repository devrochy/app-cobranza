import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cobrador } from "./cobrador.entity";
import { COBRADOR_PERMISOS, CobradorPermiso, CobradorPermisoNombre } from "./cobrador-permiso.entity";

export interface PermisoCobradorEstado {
  permiso: CobradorPermisoNombre;
  habilitado: boolean;
}

export type MatrizPermisosCobrador = Partial<Record<CobradorPermisoNombre, boolean>>;

@Injectable()
export class CobradoresPermisosService {
  constructor(
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
    @InjectRepository(CobradorPermiso)
    private readonly permisoRepo: Repository<CobradorPermiso>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getMatriz(cobradorId: number): Promise<PermisoCobradorEstado[]> {
    await this.assertCobradorExists(cobradorId);

    const filas = await this.permisoRepo.find({
      where: { cobrador: { id: cobradorId } },
    });
    const habilitados = new Map(filas.map((f) => [f.permiso, f.habilitado]));

    return COBRADOR_PERMISOS.map((permiso) => ({
      permiso,
      habilitado: habilitados.get(permiso) ?? false,
    }));
  }

  async setMatriz(
    cobradorId: number,
    matriz: MatrizPermisosCobrador,
  ): Promise<PermisoCobradorEstado[]> {
    await this.assertCobradorExists(cobradorId);

    const clavesInvalidas = Object.keys(matriz).filter(
      (key) => !(COBRADOR_PERMISOS as readonly string[]).includes(key),
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
      await queryRunner.manager.delete(CobradorPermiso, { cobrador: { id: cobradorId } });
      const filas = COBRADOR_PERMISOS.map((permiso) => ({
        cobrador: { id: cobradorId } as Cobrador,
        permiso,
        habilitado: matriz[permiso] ?? false,
      }));
      await queryRunner.manager.save(CobradorPermiso, filas);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getMatriz(cobradorId);
  }

  async assertOwnedBySocio(cobradorId: number, socioId: number): Promise<void> {
    const cobrador = await this.assertCobradorExists(cobradorId);
    if (cobrador.socioId !== socioId) {
      throw new ForbiddenException("El cobrador no pertenece al socio");
    }
  }

  async tienePermiso(
    cobradorId: number,
    permiso: CobradorPermisoNombre,
  ): Promise<boolean> {
    const fila = await this.permisoRepo.findOne({
      where: { cobrador: { id: cobradorId }, permiso, habilitado: true },
    });
    return fila !== null;
  }

  private async assertCobradorExists(cobradorId: number): Promise<Cobrador> {
    const cobrador = await this.cobradorRepo.findOne({ where: { id: cobradorId } });
    if (!cobrador) {
      throw new NotFoundException("El cobrador no existe");
    }
    return cobrador;
  }
}
