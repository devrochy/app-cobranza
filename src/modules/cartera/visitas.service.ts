import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { MetodoPago } from "../../domain/metodo-pago";
import { ES_COMPROMISO_PAGO, MotivoNoPago } from "../../domain/motivos-no-pago";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { Visita, VisitaResultado } from "./visita.entity";
import { PromesaPago, PromesaCreador } from "./promesa-pago.entity";
import { RolUsuario } from "../auth/auth.service";

export interface RegistrarVisitaInput {
  prestamoId: number;
  clienteId: number;
  resultado: VisitaResultado;
  tipoPago?: "cuota" | "abono";
  cuotaId?: number;
  valor?: number;
  metodoPago?: MetodoPago;
  motivoNoPago?: MotivoNoPago;
  fechaPrometida?: string;
  valorPrometido?: number;
}

export interface RequesterVisitaContext {
  rol: RolUsuario;
  sub: number;
}

export interface VisitaPublic {
  id: number;
  rutaId: number;
  clienteId: number;
  prestamoPrincipalId: number;
  fecha: string;
  resultado: VisitaResultado;
  motivoNoPago: MotivoNoPago | null;
  valorPagado: number | null;
  metodoPago: MetodoPago | null;
}

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Visita)
    private readonly visitaRepo: Repository<Visita>,
    @InjectRepository(PromesaPago)
    private readonly promesaRepo: Repository<PromesaPago>,
    private readonly dataSource: DataSource,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
  ) {}

  async registrar(
    rutaId: number,
    input: RegistrarVisitaInput,
    requester: RequesterVisitaContext,
  ): Promise<VisitaPublic> {
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

    const prestamo = await this.prestamoRepo.findOne({
      where: { id: input.prestamoId, ruta: { id: rutaId }, cliente: { id: input.clienteId } },
    });
    if (!prestamo) {
      throw new NotFoundException("El préstamo principal no existe en esta ruta");
    }

    if (input.resultado === "no_pago") {
      if (!input.motivoNoPago) {
        throw new BadRequestException("Debe indicar el motivo de no pago");
      }
      if (input.motivoNoPago === ES_COMPROMISO_PAGO && !input.fechaPrometida) {
        throw new BadRequestException("El motivo compromiso_de_pago requiere fechaPrometida");
      }
    } else {
      if (!input.valor || !input.metodoPago) {
        throw new BadRequestException("El pago requiere valor y método de pago");
      }
      if (input.tipoPago === "cuota" && !input.cuotaId) {
        throw new BadRequestException("El pago de cuota requiere cuotaId");
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const creador: PromesaCreador = requester.rol === "cobrador" ? "cobrador" : "agente";

    const visitaId = await this.dataSource.transaction(async (manager) => {
      const visitaRepo = manager.getRepository(Visita);
      const promesaRepo = manager.getRepository(PromesaPago);

      const visita = visitaRepo.create({
        ruta: { id: rutaId } as Visita["ruta"],
        rutaId,
        cliente: { id: cliente.id } as Visita["cliente"],
        clienteId: cliente.id,
        prestamoPrincipal: { id: prestamo.id } as Visita["prestamoPrincipal"],
        prestamoPrincipalId: prestamo.id,
        fecha,
        resultado: input.resultado,
        motivoNoPago: input.resultado === "no_pago" ? (input.motivoNoPago ?? null) : null,
        valorPagado: input.resultado === "pago" ? (input.valor ?? null) : null,
        metodoPago: input.resultado === "pago" ? (input.metodoPago ?? null) : null,
        creadoPorRol: requester.rol,
        creadoPorId: requester.sub,
      });
      const saved = await visitaRepo.save(visita);

      if (input.resultado === "pago") {
        if (input.tipoPago === "cuota") {
          // B4: la cuota a pagar debe pertenecer al préstamo principal declarado.
          const cuota = await this.cuotaRepo.findOne({
            where: { id: input.cuotaId!, prestamo: { id: prestamo.id } },
          });
          if (!cuota) {
            throw new NotFoundException("La cuota no pertenece al préstamo principal");
          }
          await this.pagosService.registrarPagoDeCuota(
            rutaId,
            { cuotaId: input.cuotaId!, valor: input.valor!, metodoPago: input.metodoPago! },
            requester,
            { manager, visitaId: saved.id },
          );
        } else {
          await this.abonosService.registrarAbono(
            rutaId,
            { prestamoId: prestamo.id, valor: input.valor!, metodoPago: input.metodoPago! },
            requester,
            { manager, visitaId: saved.id },
          );
        }
      } else if (input.motivoNoPago === ES_COMPROMISO_PAGO) {
        const valorPrometido = input.valorPrometido ?? (await this.cuotaPendienteValor(prestamo.id));
        const promesa = promesaRepo.create({
          visita: { id: saved.id } as PromesaPago["visita"],
          visitaId: saved.id,
          prestamo: { id: prestamo.id } as PromesaPago["prestamo"],
          prestamoId: prestamo.id,
          fechaPrometida: input.fechaPrometida!,
          valorPrometido,
          estado: "pendiente",
          creadoPor: creador,
        });
        await promesaRepo.save(promesa);
      }

      return saved.id;
    });

    const visitaPersistida = await this.visitaRepo.findOne({ where: { id: visitaId } });
    return this.toPublic(visitaPersistida!);
  }

  private async cuotaPendienteValor(prestamoId: number): Promise<number> {
    const cuota = await this.cuotaRepo.findOne({
      where: { prestamo: { id: prestamoId }, estatus: In(["pendiente", "atrasada"]) },
      order: { numeroCuota: "ASC" },
    });
    return cuota?.valorEsperado ?? 0;
  }

  private toPublic(visita: Visita): VisitaPublic {
    return {
      id: visita.id,
      rutaId: visita.rutaId,
      clienteId: visita.clienteId,
      prestamoPrincipalId: visita.prestamoPrincipalId,
      fecha: visita.fecha,
      resultado: visita.resultado,
      motivoNoPago: visita.motivoNoPago,
      valorPagado: visita.valorPagado,
      metodoPago: visita.metodoPago,
    };
  }
}
