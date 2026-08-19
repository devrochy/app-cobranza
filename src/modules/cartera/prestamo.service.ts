import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { calcularColorRiesgo } from "../../domain/color-riesgo";
import { Ruta } from "../rutas/ruta.entity";
import { RutaConfig } from "../rutas/ruta-config.entity";
import { RutaConfigDefaults } from "../rutas/ruta-config.service";
import { Cliente } from "./cliente.entity";
import { Cuota, CuotaEstatus } from "./cuota.entity";
import { Prestamo, PrestamoEstatus } from "./prestamo.entity";
import { ajustarDiaHabil } from "../../domain/dias-no-laborables";
import { DiasNoLaborables } from "../rutas/ruta-config.entity";
import { formatDate } from "../../common/date";

export interface CreatePrestamoInput {
  clienteId: number;
  valor: number;
  numCuotas: number;
  tipoInteres?: number;
  diasEntreCuotas: number;
  fiadorNombre?: string;
  fiadorApellido?: string;
  fiadorDocumento?: string;
  fiadorTelefono?: string;
}

export interface RequesterPrestamoContext {
  rol: RolUsuario;
  sub: number;
}

export interface CuotaPublic {
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: CuotaEstatus;
}

export interface PrestamoPublic {
  id: number;
  rutaId: number;
  clienteId: number;
  valor: number;
  numCuotas: number;
  tipoInteres: number;
  diasEntreCuotas: number;
  fechaOtorgado: Date;
  estatus: PrestamoEstatus;
  cuotas: CuotaPublic[];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

interface CuotaGenerada {
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
  estatus: CuotaEstatus;
}

@Injectable()
export class PrestamoService {
  private readonly logger = new Logger(PrestamoService.name);

  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(RutaConfig)
    private readonly configRepo: Repository<RutaConfig>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async crear(
    rutaId: number,
    input: CreatePrestamoInput,
    requester: RequesterPrestamoContext,
    fechaOtorgado: Date = new Date(),
  ): Promise<PrestamoPublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: input.clienteId, ruta: { id: rutaId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta ruta");
    }

    const config =
      (await this.configRepo.findOne({ where: { ruta: { id: rutaId } } })) ??
      (RutaConfigDefaults as RutaConfig);

    const tipoInteres = input.tipoInteres ?? ruta.tipoInteres;

    if (config.cuotasMinimasPrestamo > 0 && input.numCuotas < config.cuotasMinimasPrestamo) {
      throw new BadRequestException(
        `El número de cuotas debe ser al menos ${config.cuotasMinimasPrestamo}`,
      );
    }

    const saldoVigenteCliente = await this.saldoVigente(cliente.id);

    if (config.manejoCupoActivo) {
      if (saldoVigenteCliente + input.valor > config.cupoDefault) {
        throw new ConflictException("El préstamo excede el cupo de la ruta");
      }
    }

    // HU-14: tope de deuda del cliente (saldo vigente + valor).
    if (cliente.topeMaximoDeuda !== null && cliente.topeMaximoDeuda !== undefined) {
      if (saldoVigenteCliente + input.valor > cliente.topeMaximoDeuda) {
        throw new ConflictException("El préstamo excede el tope de deuda del cliente");
      }
    }

    // HU-14: fecha del préstamo editable ±30 días, gateada por flag de ruta.
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicio = new Date(fechaOtorgado);
    fechaInicio.setHours(0, 0, 0, 0);
    const dias = Math.round(
      (fechaInicio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (Math.abs(dias) > 30) {
      throw new BadRequestException("La fecha del préstamo no puede diferir más de 30 días de hoy");
    }
    if (!config.permitirCambioFechaPrestamo && dias !== 0) {
      throw new BadRequestException("No está permitido cambiar la fecha del préstamo");
    }

    const cuotas = this.generarCuotas(
      input.valor,
      tipoInteres,
      input.numCuotas,
      input.diasEntreCuotas,
      fechaOtorgado,
      config.diasNoLaborables,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let prestamo: Prestamo;
    try {
      prestamo = this.prestamoRepo.create({
        cliente: { id: cliente.id } as Cliente,
        clienteId: cliente.id,
        ruta: { id: rutaId } as Ruta,
        rutaId,
        valor: input.valor,
        numCuotas: input.numCuotas,
        tipoInteres,
        diasEntreCuotas: input.diasEntreCuotas,
        fechaOtorgado,
        fiadorNombre: input.fiadorNombre ?? null,
        fiadorApellido: input.fiadorApellido ?? null,
        fiadorDocumento: input.fiadorDocumento ?? null,
        fiadorTelefono: input.fiadorTelefono ?? null,
        estatus: "vigente",
      });
      prestamo = await queryRunner.manager.save(prestamo);
      const filasCuotas = cuotas.map((c) => ({
        prestamo: { id: prestamo.id } as Prestamo,
        prestamoId: prestamo.id,
        numeroCuota: c.numeroCuota,
        valorEsperado: c.valorEsperado,
        fechaVencimiento: c.fechaVencimiento,
        estatus: c.estatus,
      }));
      await queryRunner.manager.save(Cuota, filasCuotas);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Wiring del color de riesgo (HU-13): el cliente ya tiene crédito.
    // No fatal: si falla, el préstamo ya está persistido (dato derivado).
    try {
      const atraso = await this.cuotaRepo.count({
        where: { prestamo: { cliente: { id: cliente.id } }, estatus: "atrasada" },
      });
      cliente.colorRiesgo = calcularColorRiesgo(atraso, config.cuotasAtrasoUmbral, false);
      await this.clienteRepo.save(cliente);
    } catch (err) {
      this.logger.warn(`No se pudo actualizar el color de riesgo del cliente ${cliente.id}`);
    }

    return this.toPublic(prestamo, cuotas, rutaId, cliente.id, tipoInteres);
  }

  private async saldoVigente(clienteId: number): Promise<number> {
    const cuotas = await this.cuotaRepo.find({
      where: {
        prestamo: { cliente: { id: clienteId }, estatus: "vigente" },
        estatus: In(["pendiente", "atrasada"]),
      },
    });
    return cuotas.reduce((suma, cuota) => suma + cuota.valorEsperado, 0);
  }

  private generarCuotas(
    valor: number,
    tipoInteres: number,
    numCuotas: number,
    diasEntreCuotas: number,
    fechaOtorgado: Date,
    diasNoLaborables: DiasNoLaborables,
  ): CuotaGenerada[] {
    const valorTotal = valor * (1 + tipoInteres / 100);
    const cuotaBase = Math.round((valorTotal / numCuotas) * 100) / 100;

    return Array.from({ length: numCuotas }, (_, index) => {
      const esUltima = index === numCuotas - 1;
      const valorEsperado = esUltima
        ? Math.round((valorTotal - cuotaBase * (numCuotas - 1)) * 100) / 100
        : cuotaBase;
      return {
        numeroCuota: index + 1,
        valorEsperado,
        fechaVencimiento: formatDate(
          ajustarDiaHabil(
            addDays(fechaOtorgado, (index + 1) * diasEntreCuotas),
            diasNoLaborables,
          ),
        ),
        estatus: "pendiente" as const,
      };
    });
  }

  private toPublic(
    prestamo: Prestamo,
    cuotas: CuotaGenerada[],
    rutaId: number,
    clienteId: number,
    tipoInteres: number,
  ): PrestamoPublic {
    return {
      id: prestamo.id,
      rutaId,
      clienteId,
      valor: prestamo.valor,
      numCuotas: prestamo.numCuotas,
      tipoInteres,
      diasEntreCuotas: prestamo.diasEntreCuotas,
      fechaOtorgado: prestamo.fechaOtorgado,
      estatus: prestamo.estatus,
      cuotas,
    };
  }
}
