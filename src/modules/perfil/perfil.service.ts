import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { AdminUser } from "../admin-users/admin-user.entity";
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
 * Auto-actualización del perfil (nombre/apellido) para admin, socio y cobrador.
 * Cada usuario edita sus propios datos sin permisos adicionales; el rol vive en
 * el JWT (JwtAuthGuard revalida el estado activo).
 */
@Injectable()
export class PerfilService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
  ) {}

  async obtener(rol: RolUsuario, sub: number): Promise<PerfilPublic> {
    if (rol === "admin") {
      const admin = await this.adminRepo.findOne({ where: { id: sub } });
      if (!admin) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(admin);
    }

    if (rol === "cobrador") {
      const cobrador = await this.cobradorRepo.findOne({ where: { id: sub } });
      if (!cobrador) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(cobrador);
    }

    if (rol === "socio") {
      const socio = await this.socioRepo.findOne({ where: { id: sub } });
      if (!socio) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(socio);
    }

    throw new ForbiddenException("Acceso denegado");
  }

  async actualizar(
    rol: RolUsuario,
    sub: number,
    input: ActualizarPerfilInput,
  ): Promise<PerfilPublic> {
    if (rol === "admin") {
      const admin = await this.adminRepo.findOne({ where: { id: sub } });
      if (!admin) {
        throw new NotFoundException("Perfil no encontrado");
      }
      admin.nombre = input.nombre;
      admin.apellido = input.apellido;
      return this.toPublic(await this.adminRepo.save(admin));
    }

    if (rol === "cobrador") {
      const cobrador = await this.cobradorRepo.findOne({ where: { id: sub } });
      if (!cobrador) {
        throw new NotFoundException("Perfil no encontrado");
      }
      cobrador.nombre = input.nombre;
      cobrador.apellido = input.apellido;
      return this.toPublic(await this.cobradorRepo.save(cobrador));
    }

    if (rol === "socio") {
      const socio = await this.socioRepo.findOne({ where: { id: sub } });
      if (!socio) {
        throw new NotFoundException("Perfil no encontrado");
      }
      socio.nombre = input.nombre;
      socio.apellido = input.apellido;
      return this.toPublic(await this.socioRepo.save(socio));
    }

    throw new ForbiddenException("Acceso denegado");
  }

  private toPublic(entidad: AdminUser | Cobrador | Socio): PerfilPublic {
    return {
      id: entidad.id,
      usuario: entidad.usuario,
      nombre: entidad.nombre ?? "",
      apellido: entidad.apellido ?? "",
    };
  }
}
