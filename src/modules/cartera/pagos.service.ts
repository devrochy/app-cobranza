import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { MetodoPago } from "../../domain/metodo-pago";
import { ReautenticacionService } from "../security/reautenticacion.service";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { NotificacionesService } from "./notificaciones.service";
import { RolUsuario } from "../auth/auth.service";

export interface RegistrarPagoCuotaInput {
  cuotaId: number;
  valor: number;
  metodoPago: MetodoPago;
}

export interface RegistrarPagoCuotaOptions {
  manager?: EntityManager;
  visitaId?: number | null;
}

export interface RequesterPagoContext {
  rol: RolUsuario;
  sub: number;
}

export interface PagoPublic {
  id: number;
  cuotaId: number | null;
  clienteId: number;
  valor: number;
  metodoPago: MetodoPago;
  fechaHora: Date;
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

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
    private readonly cajaService: CajaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly reautenticacion: ReautenticacionService,
  ) {}

  async registrarPagoDeCuota(
    rutaId: number,
    input: RegistrarPagoCuotaInput,
    requester: RequesterPagoContext,
    options: RegistrarPagoCuotaOptions = {},
  ): Promise<PagoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cuota = await this.cuotaRepo.findOne({
      where: { id: input.cuotaId, prestamo: { ruta: { id: rutaId } } },
      relations: { prestamo: { cliente: true } },
    });
    if (!cuota) {
      throw new NotFoundException("La cuota no existe en esta ruta");
    }
    if (cuota.estatus === "pagada") {
      throw new BadRequestException("La cuota ya está pagada");
    }
    if (input.valor !== cuota.valorEsperado) {
      throw new BadRequestException(
        `El valor del pago debe coincidir con el valor de la cuota (${cuota.valorEsperado})`,
      );
    }

    const clienteId = cuota.prestamo.cliente.id;
    const prestamoId = cuota.prestamoId;
    const visitaId = options.visitaId ?? null;

    const ejecutar = async (manager: EntityManager): Promise<Pago> => {
      const cuotaRepo = manager.getRepository(Cuota);
      const pagoRepo = manager.getRepository(Pago);

      cuota.estatus = "pagada";
      await cuotaRepo.save(cuota);

      const pagoNuevo = pagoRepo.create({
        cuota: { id: cuota.id } as Pago["cuota"],
        cuotaId: cuota.id,
        cliente: { id: clienteId } as Pago["cliente"],
        clienteId,
        visitaId,
        valor: input.valor,
        metodoPago: input.metodoPago,
        registradoPor: requester.sub,
      });
      const saved = await pagoRepo.save(pagoNuevo);

      await this.cajaService.aplicarMovimiento(
        rutaId,
        input.valor,
        TipoMovimientoCaja.PAGO,
        requester,
        `cuota ${cuota.numeroCuota} (prestamo ${prestamoId})`,
        manager,
      );
      return saved;
    };

    const pago = options.manager
      ? await ejecutar(options.manager)
      : await this.dataSource.transaction(ejecutar);

    // HU-52: confirmación al cliente al registrarse el pago (no bloqueante;
    // un fallo del canal no debe romper el registro del pago ya commiteado).
    if (cuota.prestamo.cliente) {
      try {
        await this.notificacionesService.enviarConfirmacionPago(
          cuota.prestamo.cliente,
          pago.valor,
        );
      } catch (error) {
        this.logger.warn(`No se pudo enviar la confirmación de pago: ${String(error)}`);
      }
    }

    return this.toPublic(pago, clienteId);
  }

  /**
   * Elimina un pago (APK/cobrador). Solo se permite borrar pagos que NO hayan
   * sido liquidados al cierre del día (liquidacion). Requiere reautenticación
   * (password) y motivo; revierte el movimiento de caja y audita.
   */
  async eliminarPago(
    rutaId: number,
    pagoId: number,
    ctx: { password: string; motivo: string },
    requester: RequesterPagoContext,
  ): Promise<{ id: number }> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);
    await this.reautenticacion.validar(requester, ctx.password);
    if (!ctx.motivo?.trim()) {
      throw new BadRequestException("El motivo es obligatorio");
    }

    const pago = await this.pagoRepo.findOne({
      where: { id: pagoId, cuota: { prestamo: { ruta: { id: rutaId } } } },
      relations: { cuota: true },
    });
    if (!pago) {
      throw new NotFoundException("El pago no existe en esta ruta");
    }
    if (pago.liquidado) {
      throw new BadRequestException("No se puede borrar un pago ya liquidado");
    }

    const antes = { valor: pago.valor, metodoPago: pago.metodoPago };
    await this.dataSource.transaction(async (manager) => {
      const pagoRepo = manager.getRepository(Pago);
      const auditoriaRepo = manager.getRepository(AuditoriaCartera);

      await pagoRepo.delete({ id: pago.id });
      await this.cajaService.aplicarMovimiento(
        rutaId,
        -pago.valor,
        TipoMovimientoCaja.PAGO,
        requester,
        `reversión por eliminación de pago ${pago.id}`,
        manager,
      );
      const fila = auditoriaRepo.create({
        entidad: "pago",
        entidadId: pago.id,
        operacion: "eliminar",
        valoresAntes: antes,
        valoresDespues: {},
        actorRol: requester.rol,
        actorId: requester.sub,
        motivo: ctx.motivo,
      });
      await auditoriaRepo.save(fila);
    });

    return { id: pagoId };
  }

  private toPublic(pago: Pago, clienteId: number): PagoPublic {
    return {
      id: pago.id,
      cuotaId: pago.cuotaId,
      clienteId,
      valor: pago.valor,
      metodoPago: pago.metodoPago,
      fechaHora: pago.fechaHora,
    };
  }
}
