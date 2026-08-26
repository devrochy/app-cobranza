import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConversacionIa } from "../cartera/conversacion-ia.entity";

export interface ConversacionDerivadaPublic {
  id: number;
  cliente: string;
  motivo: string | null;
  derivadaEn: Date;
}

export interface MonitoreoIaPublic {
  activas: number;
  derivadas: number;
  resueltas: number;
  derivadasRecientes: ConversacionDerivadaPublic[];
}

/**
 * Panel de monitoreo de conversaciones del asistente IA (HU-24): conteos por
 * estado y las últimas conversaciones derivadas a humano.
 */
@Injectable()
export class MonitoreoIaService {
  constructor(
    @InjectRepository(ConversacionIa)
    private readonly conversacionRepo: Repository<ConversacionIa>,
  ) {}

  async obtener(): Promise<MonitoreoIaPublic> {
    const [activas, derivadas, resueltas] = await Promise.all([
      this.conversacionRepo.count({ where: { estado: "activa" } }),
      this.conversacionRepo.count({ where: { estado: "derivada" } }),
      this.conversacionRepo.count({ where: { estado: "resuelta" } }),
    ]);

    const derivadasRecientes = await this.conversacionRepo.find({
      where: { estado: "derivada" },
      order: { createdAt: "DESC" },
      take: 10,
      relations: { cliente: true },
    });

    return {
      activas,
      derivadas,
      resueltas,
      derivadasRecientes: derivadasRecientes.map((conversacion) => ({
        id: conversacion.id,
        cliente: `${conversacion.cliente?.nombre ?? ""} ${conversacion.cliente?.apellido ?? ""}`.trim(),
        motivo: conversacion.motivoDerivacion,
        derivadaEn: conversacion.createdAt,
      })),
    };
  }
}