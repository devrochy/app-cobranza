import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { Ruta } from "../rutas/ruta.entity";
import { Cliente, ClienteEstatus } from "./cliente.entity";
import { ColorRiesgo } from "../../domain/color-riesgo";

export interface CreateClienteInput {
  nombre: string;
  apellido: string;
  negocio?: string;
  telefonoWhatsapp: string;
  latitud: number;
  longitud: number;
}

export interface RequesterCarteraContext {
  rol: RolUsuario;
  sub: number;
}

export interface ClientePublic {
  id: number;
  rutaId: number;
  nombre: string;
  apellido: string;
  negocio: string | null;
  telefonoWhatsapp: string;
  latitud: number;
  longitud: number;
  estatus: ClienteEstatus;
  colorRiesgo: ColorRiesgo;
  createdAt: Date;
}

const ACCESO_DENEGADO = "Acceso denegado";

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepo: Repository<Ruta>,
    @InjectRepository(Cliente)
    private readonly repo: Repository<Cliente>,
  ) {}

  async crear(
    rutaId: number,
    input: CreateClienteInput,
    requester: RequesterCarteraContext,
  ): Promise<ClientePublic> {
    const ruta = await this.rutaRepo.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException("La ruta no existe");
    }
    this.assertOwned(ruta, requester);

    const cliente = this.repo.create({
      ruta: { id: rutaId } as Ruta,
      rutaId,
      nombre: input.nombre,
      apellido: input.apellido,
      negocio: input.negocio ?? null,
      telefonoWhatsapp: input.telefonoWhatsapp,
      latitud: input.latitud,
      longitud: input.longitud,
      estatus: "activo",
      colorRiesgo: "blanco",
    });
    const saved = await this.repo.save(cliente);
    return this.toPublic(saved, rutaId);
  }

  private assertOwned(ruta: Ruta, requester: RequesterCarteraContext): void {
    if (requester.rol === "socio" && ruta.socioId !== requester.sub) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
  }

  private toPublic(cliente: Cliente, rutaId: number): ClientePublic {
    return {
      id: cliente.id,
      rutaId,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      negocio: cliente.negocio,
      telefonoWhatsapp: cliente.telefonoWhatsapp,
      latitud: cliente.latitud,
      longitud: cliente.longitud,
      estatus: cliente.estatus,
      colorRiesgo: cliente.colorRiesgo,
      createdAt: cliente.createdAt,
    };
  }
}
