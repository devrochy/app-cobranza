import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { Caja } from "./caja.entity";
import { CajaAjusteLog } from "./caja-ajuste-log.entity";
import { Ruta } from "./ruta.entity";

export enum TipoMovimientoCaja {
  INYECCION = "inyeccion",
  INYECCION_ELIMINADA = "inyeccion_eliminada",
}

export interface ActorCaja {
  rol: RolUsuario;
  sub: number;
}

export interface CajaPublic {
  rutaId: number;
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
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
  ) {}

  async crearCaja(rutaId: number, saldoInicial: number, manager?: EntityManager): Promise<CajaPublic> {
    const cajaRepo = manager ? manager.getRepository(Caja) : this.cajaRepo;
    const caja = cajaRepo.create({
      ruta: { id: rutaId } as Caja["ruta"],
      rutaId,
      saldoInicial,
      saldoActual: saldoInicial,
    });
    const saved = await cajaRepo.save(caja);
    return this.toPublic(saved);
  }

  /**
   * Aplica un movimiento de caja (delta puede ser positivo o negativo) sobre la
   * caja de la ruta, actualizando saldo_actual y registrando un log de auditoría
   * (valor_anterior, valor_nuevo, motivo, actor).
   */
  async aplicarMovimiento(
    rutaId: number,
    delta: number,
    tipo: TipoMovimientoCaja,
    actor: ActorCaja,
    detalle?: string,
  ): Promise<CajaPublic> {
    const caja = await this.cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!caja) {
      throw new NotFoundException("La caja de la ruta no existe");
    }

    const valorAnterior = caja.saldoActual;
    caja.saldoActual = valorAnterior + delta;
    const saved = await this.cajaRepo.save(caja);

    const motivo = detalle ? `${tipo}: ${detalle}` : tipo;
    const log = this.logRepo.create({
      caja: { id: caja.id } as CajaAjusteLog["caja"],
      cajaId: caja.id,
      valorAnterior,
      valorNuevo: caja.saldoActual,
      motivo,
      actorRol: actor.rol,
      actorId: actor.sub,
    });
    await this.logRepo.save(log);

    return this.toPublic(saved);
  }

  async consultar(rutaId: number, requester?: ActorCaja): Promise<CajaPublic> {
    if (requester) {
      const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
      if (!ruta) {
        throw new NotFoundException("La ruta no existe");
      }
      assertOwned(ruta, requester);
    }
    const caja = await this.cajaRepo.findOne({ where: { ruta: { id: rutaId } } });
    if (!caja) {
      throw new NotFoundException("La caja de la ruta no existe");
    }
    return this.toPublic(caja);
  }

  private toPublic(caja: Caja): CajaPublic {
    return {
      rutaId: caja.rutaId,
      saldoInicial: caja.saldoInicial,
      saldoActual: caja.saldoActual,
      createdAt: caja.createdAt,
      updatedAt: caja.updatedAt,
    };
  }
}
