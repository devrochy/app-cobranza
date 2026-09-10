import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";

export interface PerfilPublic {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
}

export interface ActualizarPerfilInput {
  nombre: string;
  apellido: string;
}

/**
 * Auto-actualización del perfil (nombre/apellido) para cobrador y socio.
 * La APK usa `/cobrador/*` para ambos roles; este endpoint permite que cada
 * usuario edite sus propios datos sin permisos adicionales.
 */
@Injectable()
export class PerfilService {
  constructor(
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
  ) {}

  async actualizar(
    rol: RolUsuario,
    sub: number,
    input: ActualizarPerfilInput,
  ): Promise<PerfilPublic> {
    if (rol === "cobrador") {
      const cobrador = await this.cobradorRepo.findOne({ where: { id: sub } });
      if (!cobrador) {
        throw new NotFoundException("Perfil no encontrado");
      }
      cobrador.nombre = input.nombre;
      cobrador.apellido = input.apellido;
      await this.cobradorRepo.save(cobrador);
      return this.toPublic(cobrador);
    }

    if (rol === "socio") {
      const socio = await this.socioRepo.findOne({ where: { id: sub } });
      if (!socio) {
        throw new NotFoundException("Perfil no encontrado");
      }
      socio.nombre = input.nombre;
      socio.apellido = input.apellido;
      await this.socioRepo.save(socio);
      return this.toPublic(socio);
    }

    throw new ForbiddenException("Acceso denegado");
  }

  private toPublic(entidad: Cobrador | Socio): PerfilPublic {
    return {
      id: entidad.id,
      usuario: entidad.usuario,
      nombre: entidad.nombre,
      apellido: entidad.apellido,
    };
  }
}
