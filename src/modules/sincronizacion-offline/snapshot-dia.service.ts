import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ListaClientesDelDiaService } from "../rutas/lista-clientes-dia.service";
import { RutaOptimizacionService } from "../rutas/ruta-optimizacion.service";
import { Ruta } from "../rutas/ruta.entity";
import { Device } from "./device.entity";

export interface SnapshotDiaPublic {
  ruta: { id: number; nombre: string };
  clientes: unknown[];
  trayectos: unknown;
}

/**
 * Snapshot del día para la APK offline (HU-64, PRD 6.5:435): la APK descarga al
 * inicio con conexión la ruta + clientes del día + trayectos y trabaja con copia
 * local. El dispositivo ya está autenticado y vinculado a su cobrador; la ruta
 * solicitada debe pertenecer a ese cobrador.
 */
@Injectable()
export class SnapshotDiaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    private readonly listaClientesDelDiaService: ListaClientesDelDiaService,
    private readonly rutaOptimizacionService: RutaOptimizacionService,
  ) {}

  async obtenerSnapshot(device: Device, rutaId: number): Promise<SnapshotDiaPublic> {
    if (device.cobradorId == null) {
      throw new BadRequestException("El dispositivo no tiene cobrador vinculado");
    }
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    if (ruta.cobradorId !== device.cobradorId) {
      throw new ForbiddenException(
        "La ruta no pertenece al cobrador del dispositivo",
      );
    }

    const requester = { rol: "admin" as const, sub: 0 };
    const clientes = await this.listaClientesDelDiaService.obtener(rutaId, requester);

    let trayectos: unknown = null;
    try {
      trayectos = await this.rutaOptimizacionService.consultar(rutaId, requester);
    } catch (err) {
      // Sin trayecto planificado todavía: la APK trabaja con la lista de clientes.
      if (!(err instanceof NotFoundException)) {
        throw err;
      }
    }

    return {
      ruta: { id: ruta.id, nombre: ruta.nombre },
      clientes,
      trayectos,
    };
  }
}