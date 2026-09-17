import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { calcularColorRiesgo, ColorRiesgo } from "../../domain/color-riesgo";
import { CarteraConfig } from "../carteras/cartera-config.entity";
import { CarteraConfigDefaults } from "../carteras/cartera-config.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";

/**
 * HU-13: recalcula el color de riesgo de un cliente (atraso vs umbral de la
 * cartera) y lo persiste. Se invoca desde los flujos que cambian el número de
 * cuotas atrasadas/pendientes (pagos, eliminación de cuotas, job de mora).
 */
@Injectable()
export class ColorRiesgoService {
  private readonly logger = new Logger(ColorRiesgoService.name);

  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(CarteraConfig)
    private readonly configRepo: Repository<CarteraConfig>,
  ) {}

  async recalcular(
    clienteId: number,
    carteraId: number,
    manager?: EntityManager,
  ): Promise<ColorRiesgo> {
    const cuotaRepo = manager ? manager.getRepository(Cuota) : this.cuotaRepo;
    const clienteRepo = manager ? manager.getRepository(Cliente) : this.clienteRepo;
    const configRepo = manager ? manager.getRepository(CarteraConfig) : this.configRepo;

    const wherePrestamo = { cliente: { id: clienteId }, cartera: { id: carteraId } };
    const atraso = await cuotaRepo.count({
      where: { prestamo: wherePrestamo, estatus: "atrasada" },
    });
    const noPagadas = await cuotaRepo.count({
      where: { prestamo: wherePrestamo, estatus: In(["pendiente", "atrasada"]) },
    });

    const config =
      (await configRepo.findOne({ where: { cartera: { id: carteraId } } })) ??
      (CarteraConfigDefaults as CarteraConfig);

    const color = calcularColorRiesgo(atraso, config.cuotasAtrasoUmbral, noPagadas === 0);
    await clienteRepo.update({ id: clienteId }, { colorRiesgo: color });
    return color;
  }

  /** Igual que `recalcular`, pero no propaga errores (dato derivado no crítico). */
  async recalcularSeguro(
    clienteId: number,
    carteraId: number,
    manager?: EntityManager,
  ): Promise<void> {
    try {
      await this.recalcular(clienteId, carteraId, manager);
    } catch (err) {
      this.logger.warn(
        `No se pudo recalcular el color de riesgo del cliente ${clienteId}: ${String(err)}`,
      );
    }
  }
}
