import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { eliminarArchivosSubidos } from "../../common/archivos";
import { urlArchivoServible } from "../../common/url-archivo";
import type { EvidenciaArchivo } from "../../common/descarga-archivo";
import { RolUsuario } from "../auth/auth.service";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { CajaService, TipoMovimientoCaja } from "./caja.service";
import { Cartera } from "./cartera.entity";
import { Gasto, GastoEstado } from "./gasto.entity";
import { GastoEvidencia } from "./gasto-evidencia.entity";

export interface RegistrarGastoInput {
  descripcion: string;
  valor: number;
}

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
}

export interface RequesterGastoContext {
  rol: RolUsuario;
  sub: number;
}

export interface GastoPublic {
  id: number;
  carteraId: number;
  descripcion: string;
  valor: number;
  aprobado: boolean;
  aprobadoPor: number | null;
  estado: GastoEstado;
  fechaHora: Date;
  evidencias: GastoEvidenciaPublic[];
}

export interface GastoEvidenciaPublic {
  id: number;
  gastoId: number;
  nombreOriginal: string;
  mimetype: string;
  tamaño: number;
  carteraArchivo: string;
}

@Injectable()
export class GastosService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Gasto)
    private readonly gastoRepo: Repository<Gasto>,
    @InjectRepository(GastoEvidencia)
    private readonly evidenciaRepo: Repository<GastoEvidencia>,
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
    private readonly permisosPropietario: PermisosPropietarioService,
  ) {}

  async registrar(
    carteraId: number,
    input: RegistrarGastoInput,
    archivos: ArchivoSubido[],
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const gasto = await this.dataSource
      .transaction(async (manager) => {
        const gastoRepo = manager.getRepository(Gasto);
        const evidenciaRepo = manager.getRepository(GastoEvidencia);

        const nuevo = gastoRepo.create({
          cartera: { id: carteraId } as Gasto["cartera"],
          carteraId,
          descripcion: input.descripcion,
          valor: input.valor,
          creadoPor: requester.sub,
          aprobado: false,
          aprobadoPor: null,
          estado: "activo",
        });
        const saved = await gastoRepo.save(nuevo);

        for (const archivo of archivos) {
          const evidencia = evidenciaRepo.create({
            gasto: { id: saved.id } as GastoEvidencia["gasto"],
            gastoId: saved.id,
            carteraArchivo: archivo.path,
            nombreOriginal: archivo.originalname,
            mimetype: archivo.mimetype,
            tamaño: archivo.size,
            creadoPorRol: requester.rol,
            creadoPorId: requester.sub,
          });
          await evidenciaRepo.save(evidencia);
        }

        return saved;
      })
      .catch(async (err) => {
        // Limpia las evidencias ya escritas en disco si la transacción falla.
        await eliminarArchivosSubidos(archivos.map((a) => a.path));
        throw err;
      });

    return this.toPublic(gasto);
  }

  async aprobar(
    carteraId: number,
    gastoId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);
    await this.assertPuedeAprobar(cartera, requester);

    const gasto = await this.gastoRepo.findOne({ where: { id: gastoId, cartera: { id: carteraId } } });
    if (!gasto) {
      throw new NotFoundException("El gasto no existe en esta cartera");
    }

    if (gasto.aprobado) {
      return this.toPublic(gasto);
    }

    const aprobado = await this.dataSource.transaction(async (manager) => {
      const gastoRepo = manager.getRepository(Gasto);
      // Actualización atómica condicional: evita doble descuento ante concurrencia.
      const resultado = await gastoRepo.update(
        { id: gasto.id, cartera: { id: carteraId }, aprobado: false },
        { aprobado: true, aprobadoPor: requester.sub },
      );
      if (resultado.affected === 0) {
        throw new ForbiddenException("El gasto ya fue aprobado");
      }
      gasto.aprobado = true;
      gasto.aprobadoPor = requester.sub;

      await this.cajaService.aplicarMovimiento(
        carteraId,
        -gasto.valor,
        TipoMovimientoCaja.GASTO,
        requester,
        gasto.descripcion,
        manager,
      );
      return gasto;
    });

    return this.toPublic(aprobado);
  }

  async eliminar(
    carteraId: number,
    gastoId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const gasto = await this.gastoRepo.findOne({ where: { id: gastoId, cartera: { id: carteraId } } });
    if (!gasto) {
      throw new NotFoundException("El gasto no existe en esta cartera");
    }

    const estabaAprobado = gasto.aprobado;
    if (gasto.estado === "eliminado") {
      return this.toPublic(gasto);
    }

    const eliminado = await this.dataSource.transaction(async (manager) => {
      const gastoRepo = manager.getRepository(Gasto);
      // Actualización atómica condicional: evita doble reversión ante concurrencia.
      const resultado = await gastoRepo.update(
        { id: gasto.id, cartera: { id: carteraId }, estado: "activo" },
        { estado: "eliminado" },
      );
      if (resultado.affected === 0) {
        throw new ForbiddenException("El gasto ya fue eliminado");
      }
      gasto.estado = "eliminado";

      if (estabaAprobado) {
        await this.cajaService.aplicarMovimiento(
          carteraId,
          gasto.valor,
          TipoMovimientoCaja.GASTO_ELIMINADO,
          requester,
          gasto.descripcion,
          manager,
        );
      }
      return gasto;
    });

    return this.toPublic(eliminado);
  }

  async listar(
    carteraId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic[]> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const gastos = await this.gastoRepo.find({
      where: { cartera: { id: carteraId }, estado: "activo" },
      order: { fechaHora: "DESC" },
    });

    const evidencias = gastos.length
      ? await this.evidenciaRepo.find({
          where: { gasto: { id: In(gastos.map((g) => g.id)) } },
          order: { id: "ASC" },
        })
      : [];
    const evidenciasPorGasto = new Map<number, GastoEvidenciaPublic[]>();
    for (const evidencia of evidencias) {
      const lista = evidenciasPorGasto.get(evidencia.gastoId) ?? [];
      lista.push(this.evidenciaToPublic(evidencia));
      evidenciasPorGasto.set(evidencia.gastoId, lista);
    }

    return gastos.map((gasto) => ({
      ...this.toPublic(gasto),
      evidencias: evidenciasPorGasto.get(gasto.id) ?? [],
    }));
  }

  async descargarEvidencia(
    carteraId: number,
    gastoId: number,
    evidenciaId: number,
    requester: RequesterGastoContext,
  ): Promise<EvidenciaArchivo> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const gasto = await this.gastoRepo.findOne({
      where: { id: gastoId, cartera: { id: carteraId } },
    });
    if (!gasto) {
      throw new NotFoundException("El gasto no existe en esta cartera");
    }

    const evidencia = await this.evidenciaRepo.findOne({
      where: { id: evidenciaId, gasto: { id: gastoId } },
    });
    if (!evidencia) {
      throw new NotFoundException("La evidencia no existe");
    }

    return {
      carteraArchivo: evidencia.carteraArchivo,
      mimetype: evidencia.mimetype,
      nombreOriginal: evidencia.nombreOriginal,
    };
  }

  private async assertPuedeAprobar(
    cartera: Cartera,
    requester: RequesterGastoContext,
  ): Promise<void> {
    if (requester.rol === "admin") {
      return;
    }
    if (requester.rol !== "propietario") {
      throw new ForbiddenException("Acceso denegado");
    }
    const tienePermiso = await this.permisosPropietario.tienePermiso(requester.sub, "generar_reporte");
    if (!tienePermiso) {
      throw new ForbiddenException("Acceso denegado");
    }
  }

  private toPublic(gasto: Gasto): GastoPublic {
    return {
      id: gasto.id,
      carteraId: gasto.carteraId,
      descripcion: gasto.descripcion,
      valor: gasto.valor,
      aprobado: gasto.aprobado,
      aprobadoPor: gasto.aprobadoPor,
      estado: gasto.estado,
      fechaHora: gasto.fechaHora,
      evidencias: [],
    };
  }

  private evidenciaToPublic(evidencia: GastoEvidencia): GastoEvidenciaPublic {
    return {
      id: evidencia.id,
      gastoId: evidencia.gastoId,
      nombreOriginal: evidencia.nombreOriginal,
      mimetype: evidencia.mimetype,
      tamaño: evidencia.tamaño,
      carteraArchivo: urlArchivoServible(evidencia.carteraArchivo) ?? "",
    };
  }
}
