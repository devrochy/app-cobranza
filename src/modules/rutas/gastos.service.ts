import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { CajaService, TipoMovimientoCaja } from "./caja.service";
import { Ruta } from "./ruta.entity";
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
  rutaId: number;
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
  rutaArchivo: string;
}

@Injectable()
export class GastosService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Gasto)
    private readonly gastoRepo: Repository<Gasto>,
    @InjectRepository(GastoEvidencia)
    private readonly evidenciaRepo: Repository<GastoEvidencia>,
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
    private readonly permisosSocio: PermisosSocioService,
  ) {}

  async registrar(
    rutaId: number,
    input: RegistrarGastoInput,
    archivos: ArchivoSubido[],
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const gasto = await this.dataSource.transaction(async (manager) => {
      const gastoRepo = manager.getRepository(Gasto);
      const evidenciaRepo = manager.getRepository(GastoEvidencia);

      const nuevo = gastoRepo.create({
        ruta: { id: rutaId } as Gasto["ruta"],
        rutaId,
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
          rutaArchivo: archivo.path,
          nombreOriginal: archivo.originalname,
          mimetype: archivo.mimetype,
          tamaño: archivo.size,
          creadoPorRol: requester.rol,
          creadoPorId: requester.sub,
        });
        await evidenciaRepo.save(evidencia);
      }

      return saved;
    });

    return this.toPublic(gasto);
  }

  async aprobar(
    rutaId: number,
    gastoId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    await this.assertPuedeAprobar(ruta, requester);

    const gasto = await this.gastoRepo.findOne({ where: { id: gastoId, ruta: { id: rutaId } } });
    if (!gasto) {
      throw new NotFoundException("El gasto no existe en esta ruta");
    }

    if (gasto.aprobado) {
      return this.toPublic(gasto);
    }

    const aprobado = await this.dataSource.transaction(async (manager) => {
      const gastoRepo = manager.getRepository(Gasto);
      // Actualización atómica condicional: evita doble descuento ante concurrencia.
      const resultado = await gastoRepo.update(
        { id: gasto.id, ruta: { id: rutaId }, aprobado: false },
        { aprobado: true, aprobadoPor: requester.sub },
      );
      if (resultado.affected === 0) {
        throw new ForbiddenException("El gasto ya fue aprobado");
      }
      gasto.aprobado = true;
      gasto.aprobadoPor = requester.sub;

      await this.cajaService.aplicarMovimiento(
        rutaId,
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
    rutaId: number,
    gastoId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const gasto = await this.gastoRepo.findOne({ where: { id: gastoId, ruta: { id: rutaId } } });
    if (!gasto) {
      throw new NotFoundException("El gasto no existe en esta ruta");
    }

    const estabaAprobado = gasto.aprobado;
    if (gasto.estado === "eliminado") {
      return this.toPublic(gasto);
    }

    const eliminado = await this.dataSource.transaction(async (manager) => {
      const gastoRepo = manager.getRepository(Gasto);
      // Actualización atómica condicional: evita doble reversión ante concurrencia.
      const resultado = await gastoRepo.update(
        { id: gasto.id, ruta: { id: rutaId }, estado: "activo" },
        { estado: "eliminado" },
      );
      if (resultado.affected === 0) {
        throw new ForbiddenException("El gasto ya fue eliminado");
      }
      gasto.estado = "eliminado";

      if (estabaAprobado) {
        await this.cajaService.aplicarMovimiento(
          rutaId,
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
    rutaId: number,
    requester: RequesterGastoContext,
  ): Promise<GastoPublic[]> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const gastos = await this.gastoRepo.find({
      where: { ruta: { id: rutaId }, estado: "activo" },
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

  private async assertPuedeAprobar(
    ruta: Ruta,
    requester: RequesterGastoContext,
  ): Promise<void> {
    if (requester.rol === "admin") {
      return;
    }
    if (requester.rol !== "socio") {
      throw new ForbiddenException("Acceso denegado");
    }
    const tienePermiso = await this.permisosSocio.tienePermiso(requester.sub, "generar_reporte");
    if (!tienePermiso) {
      throw new ForbiddenException("Acceso denegado");
    }
  }

  private toPublic(gasto: Gasto): GastoPublic {
    return {
      id: gasto.id,
      rutaId: gasto.rutaId,
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
      rutaArchivo: evidencia.rutaArchivo,
    };
  }
}
