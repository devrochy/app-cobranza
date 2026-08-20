import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { detectarIntencion } from "../../domain/intencion-ia";
import {
  construirTextoConsultaSaldo,
  construirTextoFallback,
  ProximaCuotaInfo,
} from "../../domain/consulta-saldo-ia";
import { construirEstadoCuentaPrestamo } from "../../domain/estado-cuenta-prestamo";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { NotificacionesService } from "./notificaciones.service";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface MensajeEntrante {
  conversacionId?: number;
  telefono?: string | null;
  contenido: string;
}

/**
 * HU-27: consulta de saldo y próxima cuota por WhatsApp. Recibe el mensaje del
 * cliente (desde el webhook simulado), detecta la intención (determinista) y
 * responde automáticamente. En MVP no hay LLM: la detección es por palabras
 * clave y el fallback no deriva a humano (derivación = HU-32, posterior).
 */
@Injectable()
export class ConsultaSaldoIaService {
  private readonly logger = new Logger(ConsultaSaldoIaService.name);

  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(ConversacionIa)
    private readonly conversacionRepo: Repository<ConversacionIa>,
    @InjectRepository(Prestamo)
    private readonly prestamoRepo: Repository<Prestamo>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async procesarMensaje(entrada: MensajeEntrante): Promise<void> {
    const cliente = await this.resolverCliente(entrada.conversacionId, entrada.telefono);
    if (!cliente) {
      this.logger.warn("Consulta de saldo: no se pudo resolver el cliente, se omite la respuesta");
      return;
    }

    const intencion = detectarIntencion(entrada.contenido);
    let contenido: string;
    let intencionDetectada: string;

    if (intencion === "consulta_saldo") {
      const { totalSaldo, proximaCuota, moneda } = await this.computarSaldo(cliente);
      contenido = construirTextoConsultaSaldo(
        `${cliente.nombre} ${cliente.apellido}`.trim(),
        moneda,
        totalSaldo,
        proximaCuota,
      );
      intencionDetectada = "consulta_saldo";
    } else {
      contenido = construirTextoFallback();
      intencionDetectada = "desconocida";
    }

    const conversacion = await this.notificacionesService.obtenerConversacion(cliente);
    await this.gateway.enviarMensaje({
      conversacionId: conversacion.id,
      emisor: "ia",
      contenido,
      telefono: cliente.telefonoWhatsapp,
      intencionDetectada,
    });
  }

  private async resolverCliente(
    conversacionId?: number,
    telefono?: string | null,
  ): Promise<Cliente | null> {
    if (conversacionId) {
      const conversacion = await this.conversacionRepo.findOne({
        where: { id: conversacionId },
      });
      if (conversacion) {
        return this.clienteRepo.findOne({ where: { id: conversacion.clienteId } });
      }
    }
    if (telefono) {
      // `telefono_whatsapp` no es único global: si hay varios clientes con el
      // mismo número, no respondemos para no filtrar datos de otro cliente.
      const coincidencias = await this.clienteRepo.find({
        where: { telefonoWhatsapp: telefono },
        take: 2,
      });
      if (coincidencias.length === 1) {
        return coincidencias[0];
      }
      if (coincidencias.length > 1) {
        this.logger.warn(`Teléfono ${telefono} compartido por varios clientes; se omite la respuesta`);
      }
    }
    return null;
  }

  private async computarSaldo(
    cliente: Cliente,
  ): Promise<{ totalSaldo: number; proximaCuota: ProximaCuotaInfo | null; moneda: string }> {
    const ruta = await this.rutaRepo.findOne({ where: { id: cliente.rutaId } });
    const moneda = ruta?.moneda ?? "";

    const prestamos = await this.prestamoRepo.find({
      where: { cliente: { id: cliente.id }, estatus: "vigente" },
    });

    let totalSaldo = 0;
    let proximaCuota: ProximaCuotaInfo | null = null;

    for (const prestamo of prestamos) {
      const cuotas = await this.cuotaRepo.find({
        where: { prestamo: { id: prestamo.id } },
        order: { numeroCuota: "ASC" },
      });
      const abonos = await this.abonoRepo.find({ where: { prestamo: { id: prestamo.id } } });

      const estado = construirEstadoCuentaPrestamo(
        {
          valor: prestamo.valor,
          numCuotas: prestamo.numCuotas,
          tipoInteres: prestamo.tipoInteres,
        },
        cuotas.map((c) => ({
          numeroCuota: c.numeroCuota,
          valorEsperado: c.valorEsperado,
          fechaVencimiento: c.fechaVencimiento,
          estatus: c.estatus,
        })),
        abonos.map((a) => ({ valor: a.valor })),
      );

      totalSaldo += estado.saldoPendiente;

      for (const c of estado.cuotas) {
        const esPendiente = c.estatus === "pendiente" || c.estatus === "atrasada";
        if (esPendiente && c.saldoPendiente > 0) {
          if (
            !proximaCuota ||
            c.fechaVencimiento < proximaCuota.fechaVencimiento
          ) {
            proximaCuota = {
              numeroCuota: c.numeroCuota,
              valorEsperado: c.valorEsperado,
              fechaVencimiento: c.fechaVencimiento,
            };
          }
        }
      }
    }

    return { totalSaldo, proximaCuota, moneda };
  }
}
