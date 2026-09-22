import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "../clientes/cliente.entity";
import { Prestamo } from "../clientes/prestamo.entity";
import { Cuota } from "../clientes/cuota.entity";
import { Pago } from "../clientes/pago.entity";
import { toPoint } from "../../common/geo";
import { formatDate } from "../../common/date";
import { normalizarNumeroDocumento } from "../../domain/tipo-documento";
import { assertOwned, RequesterOwned } from "../../common/ownership";
import type { FilaImport } from "./importar-cartera.parser";

export interface ReporteFilaImport {
  fila: number;
  resultado: "creado" | "omitido";
  clienteId?: number;
  prestamoId?: number;
  detalle?: string;
}

export interface ReporteImport {
  creados: number;
  omitidos: number;
  filas: ReporteFilaImport[];
}

interface CuotaGenerada {
  numeroCuota: number;
  valorEsperado: number;
  fechaVencimiento: string;
}

/** Réplica de la generación de cuotas del préstamo (sin ajuste por días no laborables). */
function generarCuotas(
  valor: number,
  tipoInteres: number,
  numCuotas: number,
  diasEntreCuotas: number,
  fechaOtorgado: Date,
): CuotaGenerada[] {
  const valorTotal = valor * (1 + tipoInteres / 100);
  const cuotaBase = Math.round((valorTotal / numCuotas) * 100) / 100;
  return Array.from({ length: numCuotas }, (_, i) => {
    const esUltima = i === numCuotas - 1;
    const valorEsperado = esUltima
      ? Math.round((valorTotal - cuotaBase * (numCuotas - 1)) * 100) / 100
      : cuotaBase;
    const vencimiento = new Date(fechaOtorgado.getTime());
    vencimiento.setUTCDate(vencimiento.getUTCDate() + (i + 1) * diasEntreCuotas);
    return { numeroCuota: i + 1, valorEsperado, fechaVencimiento: formatDate(vencimiento) };
  });
}

/**
 * Importación masiva de una cartera desde `cartera.xlsx`: crea clientes (dedupe
 * por cédula), préstamos (dedupe por cliente + fecha) y deja el estado reportado
 * (cuotas pagadas + liquidación). No exige fotos/documento ni aplica la regla de
 * ±30 días (es una carga retroactiva). No aplica movimientos de caja.
 */
@Injectable()
export class ImportarCarteraService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cartera) private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Prestamo) private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota) private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
  ) {}

  async importar(
    carteraId: number,
    filas: FilaImport[],
    requester: RequesterOwned,
  ): Promise<ReporteImport> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const reporte: ReporteImport = { creados: 0, omitidos: 0, filas: [] };

    await this.dataSource.transaction(async (manager) => {
      const clienteRepo = manager.getRepository(Cliente);
      const prestamoRepo = manager.getRepository(Prestamo);
      const cuotaRepo = manager.getRepository(Cuota);
      const pagoRepo = manager.getRepository(Pago);

      const clientesPorCedula = new Map<string, number>();

      for (const fila of filas) {
        const cedula = normalizarNumeroDocumento(fila.cedula);
        const fecha = new Date(`${fila.fecha}T00:00:00Z`);

        let clienteId = clientesPorCedula.get(cedula);
        if (clienteId === undefined) {
          const existente = await clienteRepo.findOne({
            where: { cartera: { id: carteraId }, numeroDocumento: cedula },
          });
          if (existente) {
            clienteId = existente.id;
          } else {
            const guardado = await clienteRepo.save(
              clienteRepo.create({
                cartera: { id: carteraId } as Cartera,
                carteraId,
                nombre: fila.nombre,
                apellido: fila.apellido,
                negocio: null,
                telefonoWhatsapp: fila.telefono,
                ubicacion: toPoint(fila.latitud, fila.longitud),
                ubicacionDomicilio: null,
                topeMaximoDeuda: null,
                tipoDocumento: "ci",
                numeroDocumento: cedula,
                estatus: "activo",
                colorRiesgo: "blanco",
              }),
            );
            clienteId = guardado.id;
          }
          clientesPorCedula.set(cedula, clienteId);
        }

        const existente = await prestamoRepo.findOne({
          where: { cliente: { id: clienteId }, fechaOtorgado: fecha },
        });
        if (existente) {
          reporte.omitidos++;
          reporte.filas.push({
            fila: fila.fila,
            resultado: "omitido",
            detalle: "Préstamo ya existe (cliente + fecha)",
          });
          continue;
        }

        const tipoInteres = fila.prestamo > 0 ? (fila.interes / fila.prestamo) * 100 : 0;
        const prestamo = await prestamoRepo.save(
          prestamoRepo.create({
            cliente: { id: clienteId } as Cliente,
            clienteId,
            cartera: { id: carteraId } as Cartera,
            carteraId,
            valor: fila.prestamo,
            numCuotas: fila.numCuotas,
            tipoInteres,
            diasEntreCuotas: fila.diasEntreCuotas,
            fechaOtorgado: fecha,
            fiadorNombre: null,
            fiadorApellido: null,
            fiadorDocumento: null,
            fiadorTelefono: null,
            estatus: "vigente",
          }),
        );

        const cuotas = generarCuotas(
          fila.prestamo,
          tipoInteres,
          fila.numCuotas,
          fila.diasEntreCuotas,
          fecha,
        );
        const cuotasGuardadas = await cuotaRepo.save(
          cuotas.map((c) => ({
            prestamo: { id: prestamo.id } as Prestamo,
            prestamoId: prestamo.id,
            numeroCuota: c.numeroCuota,
            valorEsperado: c.valorEsperado,
            fechaVencimiento: c.fechaVencimiento,
            estatus: "pendiente" as const,
          })),
        );

        for (const cuota of cuotasGuardadas) {
          if (cuota.numeroCuota <= fila.cuotasALaFecha) {
            await cuotaRepo.update({ id: cuota.id }, { estatus: "pagada" });
            await pagoRepo.save(
              pagoRepo.create({
                cuota: { id: cuota.id } as Pago["cuota"],
                cuotaId: cuota.id,
                cliente: { id: clienteId } as Cliente,
                clienteId,
                visitaId: null,
                valor: cuota.valorEsperado,
                metodoPago: "efectivo",
                registradoPor: requester.sub,
              }),
            );
          }
        }

        if (fila.liquido === fila.numCuotas) {
          await prestamoRepo.update(prestamo.id, { estatus: "liquidado" });
        }

        reporte.creados++;
        reporte.filas.push({
          fila: fila.fila,
          resultado: "creado",
          clienteId,
          prestamoId: prestamo.id,
        });
      }
    });

    return reporte;
  }
}
