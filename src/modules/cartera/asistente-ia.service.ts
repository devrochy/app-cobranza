import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { detectarIntencion } from "../../domain/intencion-ia";
import {
  construirTextoConsultaSaldo,
  construirTextoFallback,
  construirTextoConfirmacionPromesa,
  construirTextoPedirFechaPromesa,
  construirTextoConfirmacionAbonoParcial,
  construirTextoConfirmacionRefinanciacion,
  construirTextoNegociacionRechazada,
  construirTextoDerivacion,
  ProximaCuotaInfo,
} from "../../domain/consulta-saldo-ia";
import { parsearPromesaPago } from "../../domain/promesa-pago-ia";
import { detectarTipoNegociacion } from "../../domain/negociacion-ia";
import { evaluarNegociacion } from "../../domain/evaluacion-negociacion-ia";
import { detectarDerivacion } from "../../domain/derivacion-ia";
import { construirEstadoCuentaPrestamo } from "../../domain/estado-cuenta-prestamo";
import { Ruta } from "../rutas/ruta.entity";
import { ReglasNegociacionIaService } from "../reglas-negociacion-ia/reglas-negociacion-ia.service";
import { Cliente } from "./cliente.entity";
import { ConversacionIa } from "./conversacion-ia.entity";
import { Prestamo } from "./prestamo.entity";
import { Cuota } from "./cuota.entity";
import { Abono } from "./abono.entity";
import { PromesaPago } from "./promesa-pago.entity";
import { NotificacionesService } from "./notificaciones.service";
import { WHATSAPP_GATEWAY, WhatsappGateway } from "./whatsapp-gateway.interface";

export interface MensajeEntrante {
  conversacionId?: number;
  telefono?: string | null;
  contenido: string;
}

interface ProximaCuotaConPrestamo extends ProximaCuotaInfo {
  prestamoId: number;
}

/**
 * Asistente conversacional por WhatsApp (HU-27 consulta de saldo, HU-28 promesa
 * de pago). Recibe el mensaje del cliente (webhook simulado), detecta la
 * intención (determinista) y responde/persiste según la intención. En MVP no hay
 * LLM: la detección y el parseo son por reglas, y el fallback no deriva a humano
 * (derivación = HU-32, posterior).
 */
@Injectable()
export class AsistenteIaService {
  private readonly logger = new Logger(AsistenteIaService.name);

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
    @InjectRepository(PromesaPago)
    private readonly promesaRepo: Repository<PromesaPago>,
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @Inject(WHATSAPP_GATEWAY)
    private readonly gateway: WhatsappGateway,
    private readonly notificacionesService: NotificacionesService,
    private readonly reglasService: ReglasNegociacionIaService,
  ) {}

  async procesarMensaje(entrada: MensajeEntrante): Promise<void> {
    const cliente = await this.resolverCliente(entrada.conversacionId, entrada.telefono);
    if (!cliente) {
      this.logger.warn("Asistente IA: no se pudo resolver el cliente, se omite la respuesta");
      return;
    }

    const conversacion = await this.notificacionesService.obtenerConversacion(cliente);
    const intencion = detectarIntencion(entrada.contenido);
    const nombre = `${cliente.nombre} ${cliente.apellido}`.trim();

    // HU-32: si el mensaje requiere atención humana, se deriva la conversación
    // y el asistente deja el caso a un agente (sin forzar la automatización).
    const derivacion = detectarDerivacion(entrada.contenido);
    if (derivacion.deriva) {
      await this.marcarDerivada(conversacion, derivacion.motivo);
      await this.gateway.enviarMensaje({
        conversacionId: conversacion.id,
        emisor: "ia",
        contenido: construirTextoDerivacion(nombre),
        telefono: cliente.telefonoWhatsapp,
        intencionDetectada: "derivacion",
      });
      return;
    }

    let contenido: string;
    let intencionDetectada: string;

    if (intencion === "consulta_saldo") {
      const { totalSaldo, proximaCuota, moneda } = await this.computarSaldo(cliente);
      contenido = construirTextoConsultaSaldo(nombre, moneda, totalSaldo, proximaCuota);
      intencionDetectada = "consulta_saldo";
    } else if (intencion === "promesa_pago") {
      const resultado = await this.registrarPromesa(cliente, entrada.contenido);
      contenido = resultado.contenido;
      intencionDetectada = resultado.intencionDetectada;
    } else {
      contenido = construirTextoFallback();
      intencionDetectada = "desconocida";
    }

    await this.gateway.enviarMensaje({
      conversacionId: conversacion.id,
      emisor: "ia",
      contenido,
      telefono: cliente.telefonoWhatsapp,
      intencionDetectada,
    });
  }

  private async marcarDerivada(
    conversacion: ConversacionIa,
    motivo: string | null,
  ): Promise<void> {
    conversacion.estado = "derivada";
    conversacion.motivoDerivacion = motivo;
    conversacion.agenteAsignadoId = null;
    await this.conversacionRepo.save(conversacion);
  }

  private async registrarPromesa(
    cliente: Cliente,
    contenido: string,
  ): Promise<{ contenido: string; intencionDetectada: string }> {
    const parseado = parsearPromesaPago(contenido);
    if (!parseado) {
      return {
        contenido: construirTextoPedirFechaPromesa(),
        intencionDetectada: "promesa_pago_clarificacion",
      };
    }

    const proxima = await this.computarProximaCuota(cliente);
    if (!proxima) {
      return {
        contenido: construirTextoConsultaSaldo(
          `${cliente.nombre} ${cliente.apellido}`.trim(),
          await this.monedaRuta(cliente),
          0,
          null,
        ),
        intencionDetectada: "promesa_pago_sin_deuda",
      };
    }

    const conversacion = await this.notificacionesService.obtenerConversacion(cliente);
    const nombre = `${cliente.nombre} ${cliente.apellido}`.trim();
    const valorPrometido = parseado.valor ?? proxima.valorEsperado;
    const tipo = detectarTipoNegociacion(contenido);

    // HU-31: evaluar la negociación contra las reglas configuradas (HU-25)
    // antes de persistir el acuerdo ("IA propone, reglas deciden").
    const reglas = await this.reglasService.obtener();
    const reprogramacionesCliente = await this.promesaRepo.count({
      where: { tipo: "refinanciacion", prestamo: { cliente: { id: cliente.id } } },
    });
    const evaluacion = evaluarNegociacion(
      {
        tipo,
        valorPrometido,
        fechaPrometida: parseado.fecha,
        valorCuota: proxima.valorEsperado,
        fechaVencimientoCuota: proxima.fechaVencimiento,
        reprogramacionesCliente,
      },
      {
        maxDiasProrroga: reglas.maxDiasProrroga,
        minAbonoAceptablePct: reglas.minAbonoAceptablePct,
        maxReprogramacionesPorCliente: reglas.maxReprogramacionesPorCliente,
      },
    );
    if (!evaluacion.aprobado) {
      return {
        contenido: construirTextoNegociacionRechazada(nombre, evaluacion.motivos),
        intencionDetectada: "promesa_pago_rechazada",
      };
    }

    // HU-32: si el saldo del cliente supera el umbral de decisión autónoma
    // configurado (HU-25), la negociación se deriva a un agente humano.
    if (reglas.umbralSaldoAutonomo > 0) {
      const { totalSaldo } = await this.computarSaldo(cliente);
      if (totalSaldo > reglas.umbralSaldoAutonomo) {
        await this.marcarDerivada(conversacion, "saldo_supera_umbral");
        return {
          contenido: construirTextoDerivacion(nombre),
          intencionDetectada: "derivacion",
        };
      }
    }

    const promesa = this.promesaRepo.create({
      prestamo: { id: proxima.prestamoId } as PromesaPago["prestamo"],
      prestamoId: proxima.prestamoId,
      conversacion: { id: conversacion.id } as PromesaPago["conversacion"],
      conversacionId: conversacion.id,
      fechaPrometida: parseado.fecha,
      valorPrometido,
      estado: "pendiente",
      creadoPor: "ia",
      tipo,
    });
    await this.promesaRepo.save(promesa);

    let contenidoConfirmacion: string;
    if (tipo === "abono_parcial") {
      contenidoConfirmacion = construirTextoConfirmacionAbonoParcial(nombre, parseado.fecha, valorPrometido);
    } else if (tipo === "refinanciacion") {
      contenidoConfirmacion = construirTextoConfirmacionRefinanciacion(nombre);
    } else {
      contenidoConfirmacion = construirTextoConfirmacionPromesa(nombre, parseado.fecha, valorPrometido);
    }

    return {
      contenido: contenidoConfirmacion,
      intencionDetectada: "promesa_pago",
    };
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
    const prestamos = await this.prestamosVigentes(cliente);
    const moneda = await this.monedaRuta(cliente);

    let totalSaldo = 0;
    let proximaCuota: ProximaCuotaInfo | null = null;

    for (const prestamo of prestamos) {
      const estado = await this.estadoDePrestamo(prestamo);
      totalSaldo += estado.saldoPendiente;

      for (const c of estado.cuotas) {
        const esPendiente = c.estatus === "pendiente" || c.estatus === "atrasada";
        if (esPendiente && c.saldoPendiente > 0) {
          if (!proximaCuota || c.fechaVencimiento < proximaCuota.fechaVencimiento) {
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

  private async computarProximaCuota(cliente: Cliente): Promise<ProximaCuotaConPrestamo | null> {
    const prestamos = await this.prestamosVigentes(cliente);

    let mejor: ProximaCuotaConPrestamo | null = null;

    for (const prestamo of prestamos) {
      const estado = await this.estadoDePrestamo(prestamo);
      for (const c of estado.cuotas) {
        const esPendiente = c.estatus === "pendiente" || c.estatus === "atrasada";
        if (esPendiente && c.saldoPendiente > 0) {
          if (!mejor || c.fechaVencimiento < mejor.fechaVencimiento) {
            mejor = {
              prestamoId: prestamo.id,
              numeroCuota: c.numeroCuota,
              valorEsperado: c.valorEsperado,
              fechaVencimiento: c.fechaVencimiento,
            };
          }
        }
      }
    }

    return mejor;
  }

  private async prestamosVigentes(cliente: Cliente): Promise<Prestamo[]> {
    return this.prestamoRepo.find({
      where: { cliente: { id: cliente.id }, estatus: "vigente" },
    });
  }

  private async monedaRuta(cliente: Cliente): Promise<string> {
    const ruta = await this.rutaRepo.findOne({ where: { id: cliente.rutaId } });
    return ruta?.moneda ?? "";
  }

  private async estadoDePrestamo(
    prestamo: Prestamo,
  ): Promise<ReturnType<typeof construirEstadoCuentaPrestamo>> {
    const cuotas = await this.cuotaRepo.find({
      where: { prestamo: { id: prestamo.id } },
      order: { numeroCuota: "ASC" },
    });
    const abonos = await this.abonoRepo.find({ where: { prestamo: { id: prestamo.id } } });

    return construirEstadoCuentaPrestamo(
      {
        valor: prestamo.valor,
        numCuotas: prestamo.numCuotas,
        tipoInteres: prestamo.tipoInteres,
      },
      cuotas.map((c) => ({
        cuotaId: c.id,
        numeroCuota: c.numeroCuota,
        valorEsperado: c.valorEsperado,
        fechaVencimiento: c.fechaVencimiento,
        estatus: c.estatus,
      })),
      abonos.map((a) => ({ valor: a.valor })),
    );
  }
}
