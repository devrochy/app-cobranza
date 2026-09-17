import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RolUsuario } from "../auth/auth.service";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Gestor } from "../gestores/gestor.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { PasswordService } from "../security/password.service";

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

export interface CambiarPasswordInput {
  passwordActual: string;
  passwordNueva: string;
}

/**
 * Auto-actualización del perfil (nombre/apellido) para admin, propietario y gestor.
 * Cada usuario edita sus propios datos sin permisos adicionales; el rol vive en
 * el JWT (JwtAuthGuard revalida el estado activo).
 */
@Injectable()
export class PerfilService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    private readonly password: PasswordService,
  ) {}

  async obtener(rol: RolUsuario, sub: number): Promise<PerfilPublic> {
    if (rol === "admin") {
      const admin = await this.adminRepo.findOne({ where: { id: sub } });
      if (!admin) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(admin);
    }

    if (rol === "gestor") {
      const gestor = await this.gestorRepo.findOne({ where: { id: sub } });
      if (!gestor) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(gestor);
    }

    if (rol === "propietario") {
      const propietario = await this.propietarioRepo.findOne({ where: { id: sub } });
      if (!propietario) {
        throw new NotFoundException("Perfil no encontrado");
      }
      return this.toPublic(propietario);
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

    if (rol === "gestor") {
      const gestor = await this.gestorRepo.findOne({ where: { id: sub } });
      if (!gestor) {
        throw new NotFoundException("Perfil no encontrado");
      }
      gestor.nombre = input.nombre;
      gestor.apellido = input.apellido;
      return this.toPublic(await this.gestorRepo.save(gestor));
    }

    if (rol === "propietario") {
      const propietario = await this.propietarioRepo.findOne({ where: { id: sub } });
      if (!propietario) {
        throw new NotFoundException("Perfil no encontrado");
      }
      propietario.nombre = input.nombre;
      propietario.apellido = input.apellido;
      return this.toPublic(await this.propietarioRepo.save(propietario));
    }

    throw new ForbiddenException("Acceso denegado");
  }

  async cambiarPassword(
    rol: RolUsuario,
    sub: number,
    input: CambiarPasswordInput,
  ): Promise<void> {
    if (rol === "admin") {
      const admin = await this.adminRepo.findOne({
        where: { id: sub },
        select: { id: true, passwordHash: true },
      });
      if (!admin) {
        throw new NotFoundException("Perfil no encontrado");
      }
      await this.assertPasswordActual(admin.passwordHash, input.passwordActual);
      await this.adminRepo.update(
        { id: sub },
        { passwordHash: await this.password.hash(input.passwordNueva) },
      );
      return;
    }

    if (rol === "gestor") {
      const gestor = await this.gestorRepo.findOne({
        where: { id: sub },
        select: { id: true, passwordHash: true },
      });
      if (!gestor) {
        throw new NotFoundException("Perfil no encontrado");
      }
      await this.assertPasswordActual(gestor.passwordHash, input.passwordActual);
      await this.gestorRepo.update(
        { id: sub },
        { passwordHash: await this.password.hash(input.passwordNueva) },
      );
      return;
    }

    if (rol === "propietario") {
      const propietario = await this.propietarioRepo.findOne({
        where: { id: sub },
        select: { id: true, passwordHash: true },
      });
      if (!propietario) {
        throw new NotFoundException("Perfil no encontrado");
      }
      await this.assertPasswordActual(propietario.passwordHash, input.passwordActual);
      await this.propietarioRepo.update(
        { id: sub },
        { passwordHash: await this.password.hash(input.passwordNueva) },
      );
      return;
    }

    throw new ForbiddenException("Acceso denegado");
  }

  private async assertPasswordActual(
    hashActual: string,
    passwordActual: string,
  ): Promise<void> {
    const coincide = await this.password.compare(passwordActual, hashActual);
    if (!coincide) {
      throw new BadRequestException("La contraseña actual es incorrecta");
    }
  }

  private toPublic(entidad: AdminUser | Gestor | Propietario): PerfilPublic {
    return {
      id: entidad.id,
      usuario: entidad.usuario,
      nombre: entidad.nombre ?? "",
      apellido: entidad.apellido ?? "",
    };
  }
}
