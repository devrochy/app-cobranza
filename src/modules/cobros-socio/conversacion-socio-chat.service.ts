import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ACCESO_DENEGADO } from "../../common/ownership";
import { RolUsuario } from "../auth/auth.service";
import { generarLinkWaMe } from "../../domain/wa-me";
import { Socio } from "../socios/socio.entity";
import { ConversacionSocio } from "./conversacion-socio.entity";
import { MensajeSocio } from "./mensaje-socio.entity";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

export interface RequesterContext {
  rol: RolUsuario;
  sub: number;
}

export interface MensajeSocioPublic {
  id: number;
  emisor: MensajeSocio["emisor"];
  contenido: string;
  tipo: MensajeSocio["tipo"];
  subtipo: string | null;
  timestamp: Date;
}

export interface HistorialConversacionSocioPublic {
  conversacion: { id: number; estado: string };
  socio: { id: number; nombre: string; apellido: string };
  waMe: string | null;
  mensajes: MensajeSocioPublic[];
}

export interface ListaConversacionSocioPublic {
  socio: { id: number; nombre: string; apellido: string };
  waMe: string | null;
  ultimoMensaje: MensajeSocioPublic | null;
}

/**
 * HU-63: historial unificado de conversación Admin↔Socio (notificaciones de
 * cobro de HU-60 + mensajes manuales), chat por simulador y enlace wa.me.
 * Acceso self-service: admin → cualquier socio; socio → solo su propia
 * conversación (403 si otro); cobrador → 403.
 */
@Injectable()
export class ConversacionSocioChatService {
  constructor(
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(MensajeSocio)
    private readonly mensajeRepo: Repository<MensajeSocio>,
    @InjectRepository(ConversacionSocio)
    private readonly conversacionRepo: Repository<ConversacionSocio>,
    private readonly notificacionesSocioService: NotificacionesSocioService,
  ) {}

  async listarConversaciones(): Promise<ListaConversacionSocioPublic[]> {
    const socios = await this.socioRepo.find({ order: { id: "ASC" } });
    const resultado: ListaConversacionSocioPublic[] = [];
    for (const socio of socios) {
      const conversacion = await this.conversacionRepo.findOne({
        where: { socio: { id: socio.id }, estado: "activa" },
        order: { id: "DESC" },
      });
      let ultimoMensaje: MensajeSocioPublic | null = null;
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
        socio: { id: socio.id, nombre: socio.nombre, apellido: socio.apellido },
        waMe: generarLinkWaMe(socio.telefono),
        ultimoMensaje,
      });
    }
    return resultado;
  }

  async obtenerHistorial(
    socioId: number,
    requester: RequesterContext,
  ): Promise<HistorialConversacionSocioPublic> {
    this.verificarAcceso(socioId, requester);

    const socio = await this.socioRepo.findOne({ where: { id: socioId } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }
    const conversacion = await this.notificacionesSocioService.obtenerConversacion(socioId);
    const mensajes = await this.mensajeRepo.find({
      where: { conversacion: { id: conversacion.id } },
      order: { timestamp: "ASC" },
    });

    return {
      conversacion: { id: conversacion.id, estado: conversacion.estado },
      socio: { id: socio.id, nombre: socio.nombre, apellido: socio.apellido },
      waMe: generarLinkWaMe(socio.telefono),
      mensajes: mensajes.map((m) => this.toMensajePublic(m)),
    };
  }

  async enviarMensaje(
    socioId: number,
    contenido: string,
    requester: RequesterContext,
  ): Promise<MensajeSocioPublic> {
    this.verificarAcceso(socioId, requester);

    const socio = await this.socioRepo.findOne({ where: { id: socioId } });
    if (!socio) {
      throw new NotFoundException("El socio no existe");
    }
    const conversacion = await this.notificacionesSocioService.obtenerConversacion(socioId);
    const emisor: MensajeSocio["emisor"] = requester.rol === "socio" ? "socio" : "admin";
    const mensaje = await this.mensajeRepo.save(
      this.mensajeRepo.create({
        conversacion: { id: conversacion.id } as ConversacionSocio,
        conversacionId: conversacion.id,
        emisor,
        contenido,
        tipo: "manual",
        subtipo: null,
      }),
    );
    return this.toMensajePublic(mensaje);
  }

  private verificarAcceso(socioId: number, requester: RequesterContext): void {
    if (requester.rol === "cobrador") {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    if (requester.rol === "socio" && requester.sub !== socioId) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
  }

  private toMensajePublic(mensaje: MensajeSocio): MensajeSocioPublic {
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