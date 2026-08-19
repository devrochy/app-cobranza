import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { ReautenticacionService } from "../security/reautenticacion.service";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";

export interface EditarCuotaInput {
  valorEsperado?: number;
  fechaVencimiento?: string;
}

export interface OperacionAuditadaContext {
  password: string;
  motivo: string;
}

export interface RequesterCuotaContext {
  rol: RolUsuario;
  sub: number;
}

export interface CuotaPublic {
  id: number;
  prestamoId: number;
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: Cuota["estatus"];
}

@Injectable()
export class CuotaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(AuditoriaCartera)
    private readonly auditoriaRepo: Repository<AuditoriaCartera>,
    private readonly dataSource: DataSource,
    private readonly reautenticacion: ReautenticacionService,
    private readonly cajaService: CajaService,
  ) {}

  async editarCuota(
    rutaId: number,
    cuotaId: number,
    input: EditarCuotaInput,
    ctx: OperacionAuditadaContext,
    requester: RequesterCuotaContext,
  ): Promise<CuotaPublic> {
    await this.assertAcceso(rutaId, requester, ctx);

    const cuota = await this.buscarCuota(rutaId, cuotaId);
    if (!input.valorEsperado && !input.fechaVencimiento) {
      throw new BadRequestException("No hay campos para editar");
    }
    if (input.valorEsperado !== undefined && input.valorEsperado <= 0) {
      throw new BadRequestException("El valor de la cuota debe ser mayor que 0");
    }
    if (!ctx.motivo?.trim()) {
      throw new BadRequestException("El motivo es obligatorio");
    }

    const antes = this.snapshot(cuota);
    const esPagada = cuota.estatus === "pagada";
    const valorAnterior = cuota.valorEsperado;
    if (input.valorEsperado !== undefined) cuota.valorEsperado = input.valorEsperado;
    if (input.fechaVencimiento !== undefined) cuota.fechaVencimiento = input.fechaVencimiento;
    const despues = this.snapshot(cuota);

    await this.dataSource.transaction(async (manager) => {
      const cuotaRepo = manager.getRepository(Cuota);
      const pagoRepo = manager.getRepository(Pago);
      const auditoriaRepo = manager.getRepository(AuditoriaCartera);
      await cuotaRepo.save(cuota);
      await this.registrarAuditoria(
        auditoriaRepo,
        "cuota",
        cuota.id,
        "editar",
        antes,
        despues,
        requester,
        ctx.motivo,
      );
      if (esPagada && input.valorEsperado !== undefined) {
        const delta = input.valorEsperado - valorAnterior;
        // Mantiene el pago consistente con la cuota y la caja (HU-48).
        const pago = await pagoRepo.findOne({ where: { cuota: { id: cuota.id } } });
        if (pago) {
          pago.valor = input.valorEsperado;
          await pagoRepo.save(pago);
        }
        if (delta !== 0) {
          await this.cajaService.aplicarMovimiento(
            rutaId,
            delta,
            TipoMovimientoCaja.PAGO,
            requester,
            `ajuste por edición de cuota ${cuota.numeroCuota}`,
            manager,
          );
        }
      }
    });

    return this.toPublic(cuota);
  }

  async eliminarCuota(
    rutaId: number,
    cuotaId: number,
    ctx: OperacionAuditadaContext,
    requester: RequesterCuotaContext,
  ): Promise<{ id: number }> {
    await this.assertAcceso(rutaId, requester, ctx);
    if (!ctx.motivo?.trim()) {
      throw new BadRequestException("El motivo es obligatorio");
    }

    const cuota = await this.buscarCuota(rutaId, cuotaId);
    const esPagada = cuota.estatus === "pagada";
    const antes = this.snapshot(cuota);

    await this.dataSource.transaction(async (manager) => {
      const cuotaRepo = manager.getRepository(Cuota);
      const pagoRepo = manager.getRepository(Pago);
      const auditoriaRepo = manager.getRepository(AuditoriaCartera);

      if (esPagada) {
        const pago = await pagoRepo.findOne({ where: { cuota: { id: cuotaId } } });
        if (pago) {
          pago.cuotaId = null;
          pago.cuota = null;
          await pagoRepo.save(pago);
        }
        await this.cajaService.aplicarMovimiento(
          rutaId,
          -cuota.valorEsperado,
          TipoMovimientoCaja.PAGO,
          requester,
          `reversión por eliminación de cuota pagada ${cuota.numeroCuota}`,
          manager,
        );
      }

      await cuotaRepo.delete({ id: cuota.id });
      await this.registrarAuditoria(
        auditoriaRepo,
        "cuota",
        cuota.id,
        "eliminar",
        antes,
        {},
        requester,
        ctx.motivo,
      );
    });

    return { id: cuotaId };
  }

  private async assertAcceso(
    rutaId: number,
    requester: RequesterCuotaContext,
    ctx: OperacionAuditadaContext,
  ): Promise<void> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    await this.reautenticacion.validar(requester, ctx.password);
  }

  private async buscarCuota(rutaId: number, cuotaId: number): Promise<Cuota> {
    const cuota = await this.cuotaRepo.findOne({
      where: { id: cuotaId, prestamo: { ruta: { id: rutaId } } },
      relations: { prestamo: true },
    });
    if (!cuota) {
      throw new NotFoundException("La cuota no existe en esta ruta");
    }
    return cuota;
  }

  private snapshot(cuota: Cuota): Record<string, unknown> {
    return {
      valorEsperado: cuota.valorEsperado,
      fechaVencimiento: cuota.fechaVencimiento,
      estatus: cuota.estatus,
    };
  }

  private async registrarAuditoria(
    repo: Repository<AuditoriaCartera>,
    entidad: AuditoriaCartera["entidad"],
    entidadId: number,
    operacion: AuditoriaCartera["operacion"],
    antes: Record<string, unknown>,
    despues: Record<string, unknown>,
    requester: RequesterCuotaContext,
    motivo: string,
  ): Promise<void> {
    const fila = repo.create({
      entidad,
      entidadId,
      operacion,
      valoresAntes: antes,
      valoresDespues: despues,
      actorRol: requester.rol,
      actorId: requester.sub,
      motivo,
    });
    await repo.save(fila);
  }

  private toPublic(cuota: Cuota): CuotaPublic {
    return {
      id: cuota.id,
      prestamoId: cuota.prestamoId,
      numeroCuota: cuota.numeroCuota,
      valorEsperado: cuota.valorEsperado,
      fechaVencimiento: cuota.fechaVencimiento,
      estatus: cuota.estatus,
    };
  }
}
