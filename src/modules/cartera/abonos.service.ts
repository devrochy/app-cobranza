import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { MetodoPago } from "../../domain/metodo-pago";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { Abono } from "./abono.entity";
import { RolUsuario } from "../auth/auth.service";

export interface RegistrarAbonoInput {
  prestamoId: number;
  valor: number;
  metodoPago: MetodoPago;
}

export interface RequesterAbonoContext {
  rol: RolUsuario;
  sub: number;
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
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
  ) {}

  async registrarAbono(
    rutaId: number,
    input: RegistrarAbonoInput,
    requester: RequesterAbonoContext,
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
    const abono = await this.dataSource.transaction(async (manager) => {
      const abonoRepo = manager.getRepository(Abono);
      const abonoNuevo = abonoRepo.create({
        prestamo: { id: prestamo.id } as Abono["prestamo"],
        prestamoId: prestamo.id,
        cliente: { id: clienteId } as Abono["cliente"],
        clienteId,
        visitaId: null,
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
    });

    return this.toPublic(abono, clienteId);
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
