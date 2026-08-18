import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { MetodoPago } from "../../domain/metodo-pago";
import { Ruta } from "../rutas/ruta.entity";
import { CajaService, TipoMovimientoCaja } from "../rutas/caja.service";
import { Cuota } from "./cuota.entity";
import { Pago } from "./pago.entity";
import { RolUsuario } from "../auth/auth.service";

export interface RegistrarPagoCuotaInput {
  cuotaId: number;
  valor: number;
  metodoPago: MetodoPago;
}

export interface RequesterPagoContext {
  rol: RolUsuario;
  sub: number;
}

export interface PagoPublic {
  id: number;
  cuotaId: number;
  clienteId: number;
  valor: number;
  metodoPago: MetodoPago;
  fechaHora: Date;
}

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    private readonly dataSource: DataSource,
    private readonly cajaService: CajaService,
  ) {}

  async registrarPagoDeCuota(
    rutaId: number,
    input: RegistrarPagoCuotaInput,
    requester: RequesterPagoContext,
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

    const pago = await this.dataSource.transaction(async (manager) => {
      const cuotaRepo = manager.getRepository(Cuota);
      const pagoRepo = manager.getRepository(Pago);

      cuota.estatus = "pagada";
      await cuotaRepo.save(cuota);

      const pagoNuevo = pagoRepo.create({
        cuota: { id: cuota.id } as Pago["cuota"],
        cuotaId: cuota.id,
        cliente: { id: clienteId } as Pago["cliente"],
        clienteId,
        visitaId: null,
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
    });

    return this.toPublic(pago, clienteId);
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
