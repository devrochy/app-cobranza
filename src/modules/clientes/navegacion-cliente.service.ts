import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { assertOwned } from "../../common/ownership";
import { fromPoint } from "../../common/geo";
import { RolUsuario } from "../auth/auth.service";
import { CoordenadaGeo, EnlacesNavegacion, generarEnlacesNavegacion } from "../../domain/navegacion";
import { Cartera } from "../carteras/cartera.entity";
import { Cliente } from "./cliente.entity";

export interface RequesterNavegacionContext {
  rol: RolUsuario;
  sub: number;
}

@Injectable()
export class NavegacionClienteService {
  constructor(
    @InjectRepository(Cartera)
    private readonly carteraRepo: Repository<Cartera>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  async obtener(
    carteraId: number,
    clienteId: number,
    origen: CoordenadaGeo,
    requester: RequesterNavegacionContext,
  ): Promise<EnlacesNavegacion> {
    const cartera = await this.carteraRepo.findOne({ where: { id: carteraId } });
    if (!cartera) {
      throw new NotFoundException("La cartera no existe");
    }
    assertOwned(cartera, requester);

    const cliente = await this.clienteRepo.findOne({
      where: { id: clienteId, cartera: { id: carteraId } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe en esta cartera");
    }
    if (!cliente.ubicacion) {
      throw new NotFoundException("El cliente no tiene ubicación registrada");
    }

    const destino = fromPoint(cliente.ubicacion);
    return generarEnlacesNavegacion(origen, destino);
  }
}