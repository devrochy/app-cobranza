import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { MetodoPago } from "../../domain/metodo-pago";
import { ReautenticacionService } from "../security/reautenticacion.service";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { Abono } from "./abono.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { RolUsuario } from "../auth/auth.service";

export interface RegistrarAbonoInput {
  prestamoId: number;
  valor: number;
  metodoPago: MetodoPago;
}

export interface RegistrarAbonoOptions {
  manager?: EntityManager;
  visitaId?: number | null;
}

export interface RequesterAbonoContext {
  rol: RolUsuario;
  sub: number;
}

export interface OperacionAbonoContext {
  password: string;
  motivo: string;
}

export interface AbonoPublic {
  id: number;
  prestamoId: number;
  clienteId: number;
  valor: number;
  metodoPago: MetodoPago;
  fechaHora: Date;
}

@Injectable()
export class AbonosService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @InjectRepository(AuditoriaCartera)
    private readonly auditoriaRepo: Repository<AuditoriaCartera>,
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
    private readonly reautenticacion: ReautenticacionService,
  ) {}

  async registrarAbono(
    rutaId: number,
    input: RegistrarAbonoInput,
    requester: RequesterAbonoContext,
    options: RegistrarAbonoOptions = {},
  ): Promise<AbonoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const prestamo = await this.prestamoRepo.findOne({
      where: { id: input.prestamoId, ruta: { id: rutaId } },
      relations: { cliente: true },
    });
    if (!prestamo || prestamo.estatus !== "vigente") {
      throw new NotFoundException("El préstamo no existe o no está vigente en esta ruta");
    }

    const deudaPendiente = await this.deudaPendiente(prestamo.id);
    const abonosPrevios = await this.sumaAbonos(prestamo.id);
    const deudaActual = deudaPendiente - abonosPrevios;

    if (input.valor > deudaActual) {
      throw new BadRequestException(
        `El abono excede la deuda pendiente del préstamo (${deudaActual})`,
      );
    }

    const clienteId = prestamo.cliente.id;
    const visitaId = options.visitaId ?? null;

    const ejecutar = async (manager: EntityManager): Promise<Abono> => {
      const abonoRepo = manager.getRepository(Abono);
      const abonoNuevo = abonoRepo.create({
        prestamo: { id: prestamo.id } as Abono["prestamo"],
        prestamoId: prestamo.id,
        cliente: { id: clienteId } as Abono["cliente"],
        clienteId,
        visitaId,
        valor: input.valor,
        metodoPago: input.metodoPago,
        registradoPor: requester.sub,
      });
      const saved = await abonoRepo.save(abonoNuevo);

      await this.cajaService.aplicarMovimiento(
        rutaId,
        input.valor,
        TipoMovimientoCaja.ABONO,
        requester,
        `abono prestamo ${prestamo.id}`,
        manager,
      );
      return saved;
    };

    const abono = options.manager
      ? await ejecutar(options.manager)
      : await this.dataSource.transaction(ejecutar);

    return this.toPublic(abono, clienteId);
  }

  async eliminarAbono(
    rutaId: number,
    abonoId: number,
    ctx: OperacionAbonoContext,
    requester: RequesterAbonoContext,
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

    const abono = await this.abonoRepo.findOne({ where: { id: abonoId, prestamo: { ruta: { id: rutaId } } } });
    if (!abono) {
      throw new NotFoundException("El abono no existe en esta ruta");
    }

    const antes = { valor: abono.valor, metodoPago: abono.metodoPago };
    await this.dataSource.transaction(async (manager) => {
      const abonoRepo = manager.getRepository(Abono);
      const auditoriaRepo = manager.getRepository(AuditoriaCartera);

      await abonoRepo.delete({ id: abono.id });
      await this.cajaService.aplicarMovimiento(
        rutaId,
        -abono.valor,
        TipoMovimientoCaja.ABONO,
        requester,
        `reversión por eliminación de abono ${abono.id}`,
        manager,
      );
      const fila = auditoriaRepo.create({
        entidad: "abono",
        entidadId: abono.id,
        operacion: "eliminar",
        valoresAntes: antes,
        valoresDespues: {},
        actorRol: requester.rol,
        actorId: requester.sub,
        motivo: ctx.motivo,
      });
      await auditoriaRepo.save(fila);
    });

    return { id: abonoId };
  }

  private async deudaPendiente(prestamoId: number): Promise<number> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { id: prestamoId }, estatus: In(["pendiente", "atrasada"]) },
    });
    return cuotas.reduce((suma, cuota) => suma + cuota.valorEsperado, 0);
  }

  private async sumaAbonos(prestamoId: number): Promise<number> {
    const abonos = await this.abonoRepo.find({ where: { prestamo: { id: prestamoId } } });
    return abonos.reduce((suma, abono) => suma + abono.valor, 0);
  }

  private toPublic(abono: Abono, clienteId: number): AbonoPublic {
    return {
      id: abono.id,
      prestamoId: abono.prestamoId,
      clienteId,
      valor: abono.valor,
      metodoPago: abono.metodoPago,
      fechaHora: abono.fechaHora,
    };
  }
}
