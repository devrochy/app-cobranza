import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ListaClientesDelDiaService } from "../carteras/lista-clientes-dia.service";
import { CarteraOptimizacionService } from "../carteras/cartera-optimizacion.service";
import { Cartera } from "../carteras/cartera.entity";
import { Device } from "./device.entity";
import { SnapshotCifrado, SnapshotCryptoService } from "./snapshot-crypto.service";

export interface SnapshotDiaPublic {
  cartera: { id: number; nombre: string };
  clientes: unknown[];
  trayectos: unknown;
}

export type SnapshotDiaResult = SnapshotDiaPublic | SnapshotCifrado;

/**
 * Snapshot del día para la APK offline (HU-64, PRD 6.5:435): la APK descarga al
 * inicio con conexión la cartera + clientes del día + trayectos y trabaja con copia
 * local. El dispositivo ya está autenticado y vinculado a su gestor; la cartera
 * solicitada debe pertenecer a ese gestor.
 */
@Injectable()
export class SnapshotDiaService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    private readonly listaClientesDelDiaService: ListaClientesDelDiaService,
    private readonly carteraOptimizacionService: CarteraOptimizacionService,
    private readonly crypto: SnapshotCryptoService,
  ) {}

  async obtenerSnapshot(
    device: Device,
    carteraId: number,
  ): Promise<SnapshotDiaResult> {
    if (device.gestorId == null) {
      throw new BadRequestException("El dispositivo no tiene gestor vinculado");
    }
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    if (cartera.gestorId !== device.gestorId) {
      throw new ForbiddenException(
        "La cartera no pertenece al gestor del dispositivo",
      );
    }

    const requester = { rol: "admin" as const, sub: 0 };
    const clientes = await this.listaClientesDelDiaService.obtener(carteraId, requester);

    let trayectos: unknown = null;
    try {
      trayectos = await this.carteraOptimizacionService.consultar(carteraId, requester);
    } catch (err) {
      // Sin trayecto planificado todavía: la APK trabaja con la lista de clientes.
      if (!(err instanceof NotFoundException)) {
        throw err;
      }
    }

    const snapshot: SnapshotDiaPublic = {
      cartera: { id: cartera.id, nombre: cartera.nombre },
      clientes,
      trayectos,
    };

    // HU-40: si el dispositivo registró su clave pública X25519, el snapshot se
    // entrega cifrado (solo la APK con la clave privada puede leerlo).
    if (device.publicKey) {
      return this.crypto.cifrar(
        device.publicKey,
        Buffer.from(JSON.stringify(snapshot), "utf8"),
      );
    }

    return snapshot;
  }
}