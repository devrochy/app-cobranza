import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ACCESO_DENEGADO } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { generarLinkWaMe } from "../../domain/wa-me";
import { Propietario } from "../propietarios/propietario.entity";
import { ConversacionPropietario } from "./conversacion-propietario.entity";
import { MensajePropietario } from "./mensaje-propietario.entity";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";

export interface RequesterContext {
  rol: RolUsuario;
  sub: number;
}

export interface MensajePropietarioPublic {
  id: number;
  emisor: MensajePropietario["emisor"];
  contenido: string;
  tipo: MensajePropietario["tipo"];
  subtipo: string | null;
  timestamp: Date;
}

export interface HistorialConversacionPropietarioPublic {
  conversacion: { id: number; estado: string };
  propietario: { id: number; nombre: string; apellido: string };
  waMe: string | null;
  mensajes: MensajePropietarioPublic[];
}

export interface ListaConversacionPropietarioPublic {
  propietario: { id: number; nombre: string; apellido: string };
  waMe: string | null;
  ultimoMensaje: MensajePropietarioPublic | null;
}

/**
 * HU-63: historial unificado de conversación Admin↔Propietario (notificaciones de
 * cobro de HU-60 + mensajes manuales), chat por simulador y enlace wa.me.
 * Acceso self-service: admin → cualquier propietario; propietario → solo su propia
 * conversación (403 si otro); gestor → 403.
 */
@Injectable()
export class ConversacionPropietarioChatService {
  constructor(
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(MensajePropietario)
    private readonly mensajeRepo: Repository<MensajePropietario>,
    @InjectRepository(ConversacionPropietario)
    private readonly conversacionRepo: Repository<ConversacionPropietario>,
    private readonly notificacionesPropietarioService: NotificacionesPropietarioService,
  ) {}

  async listarConversaciones(): Promise<ListaConversacionPropietarioPublic[]> {
    const propietarios = await this.propietarioRepo.find({ order: { id: "ASC" } });
    const resultado: ListaConversacionPropietarioPublic[] = [];
    for (const propietario of propietarios) {
      const conversacion = await this.conversacionRepo.findOne({
        where: { propietario: { id: propietario.id }, estado: "activa" },
        order: { id: "DESC" },
      });
      let ultimoMensaje: MensajePropietarioPublic | null = null;
      if (conversacion) {
        const ultimo = await this.mensajeRepo.findOne({
          where: { conversacion: { id: conversacion.id } },
          order: { timestamp: "DESC" },
        });
        if (ultimo) {
          ultimoMensaje = this.toMensajePublic(ultimo);
        }
      }
      resultado.push({
        propietario: { id: propietario.id, nombre: propietario.nombre, apellido: propietario.apellido },
        waMe: generarLinkWaMe(propietario.telefono),
        ultimoMensaje,
      });
    }
    return resultado;
  }

  async obtenerHistorial(
    propietarioId: number,
    requester: RequesterContext,
  ): Promise<HistorialConversacionPropietarioPublic> {
    this.verificarAcceso(propietarioId, requester);

    const propietario = await this.propietarioRepo.findOne({ where: { id: propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }
    const conversacion = await this.notificacionesPropietarioService.obtenerConversacion(propietarioId);
    const mensajes = await this.mensajeRepo.find({
      where: { conversacion: { id: conversacion.id } },
      order: { timestamp: "ASC" },
    });

    return {
      conversacion: { id: conversacion.id, estado: conversacion.estado },
      propietario: { id: propietario.id, nombre: propietario.nombre, apellido: propietario.apellido },
      waMe: generarLinkWaMe(propietario.telefono),
      mensajes: mensajes.map((m) => this.toMensajePublic(m)),
    };
  }

  async enviarMensaje(
    propietarioId: number,
    contenido: string,
    requester: RequesterContext,
  ): Promise<MensajePropietarioPublic> {
    this.verificarAcceso(propietarioId, requester);

    const propietario = await this.propietarioRepo.findOne({ where: { id: propietarioId } });
    if (!propietario) {
      throw new NotFoundException("El propietario no existe");
    }
    const conversacion = await this.notificacionesPropietarioService.obtenerConversacion(propietarioId);
    const emisor: MensajePropietario["emisor"] = requester.rol === "propietario" ? "propietario" : "admin";
    const mensaje = await this.mensajeRepo.save(
      this.mensajeRepo.create({
        conversacion: { id: conversacion.id } as ConversacionPropietario,
        conversacionId: conversacion.id,
        emisor,
        contenido,
        tipo: "manual",
        subtipo: null,
      }),
    );
    return this.toMensajePublic(mensaje);
  }

  private verificarAcceso(propietarioId: number, requester: RequesterContext): void {
    if (requester.rol === "gestor") {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    if (requester.rol === "propietario" && requester.sub !== propietarioId) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
  }

  private toMensajePublic(mensaje: MensajePropietario): MensajePropietarioPublic {
    return {
      id: mensaje.id,
      emisor: mensaje.emisor,
      contenido: mensaje.contenido,
      tipo: mensaje.tipo,
      subtipo: mensaje.subtipo,
      timestamp: mensaje.timestamp,
    };
  }
}