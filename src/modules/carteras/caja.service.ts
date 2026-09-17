import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { Cartera } from "./cartera.entity";

export enum TipoMovimientoCaja {
  INYECCION = "inyeccion",
  INYECCION_ELIMINADA = "inyeccion_eliminada",
  PAGO = "pago",
  ABONO = "abono",
  GASTO = "gasto",
  GASTO_ELIMINADO = "gasto_eliminado",
}

export interface ActorCaja {
  rol: RolUsuario;
  sub: number;
}

export interface CajaPublic {
  carteraId: number;
  saldoInicial: number;
  saldoActual: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(CajaAjusteLog)
    private readonly logRepo: Repository<CajaAjusteLog>,
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
  ) {}

  async crearCaja(carteraId: number, saldoInicial: number, manager?: EntityManager): Promise<CajaPublic> {
    const cajaRepo = manager ? manager.getRepository(Caja) : this.cajaRepo;
    const caja = cajaRepo.create({
      cartera: { id: carteraId } as Caja["cartera"],
      carteraId,
      saldoInicial,
      saldoActual: saldoInicial,
    });
    const saved = await cajaRepo.save(caja);
    return this.toPublic(saved);
  }

  /**
   * Aplica un movimiento de caja (delta puede ser positivo o negativo) sobre la
   * caja de la cartera, actualizando saldo_actual y registrando un log de auditoría
   * (valor_anterior, valor_nuevo, motivo, actor).
   */
  async aplicarMovimiento(
    carteraId: number,
    delta: number,
    tipo: TipoMovimientoCaja,
    actor: ActorCaja,
    detalle?: string,
    manager?: EntityManager,
  ): Promise<CajaPublic> {
    const cajaRepo = manager ? manager.getRepository(Caja) : this.cajaRepo;
    const logRepo = manager ? manager.getRepository(CajaAjusteLog) : this.logRepo;
    // Lock pesimista: serializa movimientos concurrentes sobre la misma caja
    // (read-modify-write del saldo) para evitar lost updates.
    const caja = await cajaRepo.findOne({
      where: { cartera: { id: carteraId } },
      lock: { mode: "pessimistic_write" },
    });
    if (!caja) {
      throw new NotFoundException("La caja de la cartera no existe");
    }

    const valorAnterior = caja.saldoActual;
    caja.saldoActual = valorAnterior + delta;
    const saved = await cajaRepo.save(caja);

    const motivo = detalle ? `${tipo}: ${detalle}` : tipo;
    const log = logRepo.create({
      caja: { id: caja.id } as CajaAjusteLog["caja"],
      cajaId: caja.id,
      valorAnterior,
      valorNuevo: caja.saldoActual,
      motivo,
      actorRol: actor.rol,
      actorId: actor.sub,
    });
    await logRepo.save(log);

    return this.toPublic(saved);
  }

  async consultar(carteraId: number, requester?: ActorCaja): Promise<CajaPublic> {
    if (requester) {
      const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
      if (!cartera) {
        throw new NotFoundException("La cartera no existe");
      }
      assertOwned(cartera, requester);
    }
    const caja = await this.cajaRepo.findOne({ where: { cartera: { id: carteraId } } });
    if (!caja) {
      throw new NotFoundException("La caja de la cartera no existe");
    }
    return this.toPublic(caja);
  }

  private toPublic(caja: Caja): CajaPublic {
    return {
      carteraId: caja.carteraId,
      saldoInicial: caja.saldoInicial,
      saldoActual: caja.saldoActual,
      createdAt: caja.createdAt,
      updatedAt: caja.updatedAt,
    };
  }
}
