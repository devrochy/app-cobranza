import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { fromPoint } from "../../common/geo";
import { RolUsuario } from "../auth/auth.service";
import { CoordenadaGeo, EnlacesNavegacion, generarEnlacesNavegacion } from "../../domain/navegacion";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente } from "./cliente.entity";

export interface RequesterNavegacionContext {
  rol: RolUsuario;
  sub: number;
}

@Injectable()
export class NavegacionClienteService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  async obtener(
    rutaId: number,
    clienteId: number,
    origen: CoordenadaGeo,
    requester: RequesterNavegacionContext,
  ): Promise<EnlacesNavegacion> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    assertOwned(ruta, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, ruta: { id: rutaId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta ruta");
    }
    if (!cliente.ubicacion) {
      throw new NotFoundException("El cliente no tiene ubicación registrada");
    }

    const destino = fromPoint(cliente.ubicacion);
    return generarEnlacesNavegacion(origen, destino);
  }
}