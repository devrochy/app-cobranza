import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Propietario } from "../propietarios/propietario.entity";
import { Gestor } from "../gestores/gestor.entity";
import { RolUsuario } from "../auth/auth.service";
import { PasswordService } from "./password.service";

export interface ActorReautenticable {
  rol: RolUsuario;
  sub: number;
}

/**
 * Verifica la contraseña del operador (re-autenticación, HU-48) antes de
 * operaciones sensibles sobre cartera. Admin, propietario y gestor consultan su
 * propio hash.
 */
@Injectable()
export class ReautenticacionService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Propietario)
    private readonly propietarioRepo: Repository<Propietario>,
    @InjectRepository(Gestor)
    private readonly gestorRepo: Repository<Gestor>,
    private readonly passwordService: PasswordService,
  ) {}

  async validar(actor: ActorReautenticable, password: string): Promise<void> {
    let hash: string | null = null;
    if (actor.rol === "admin") {
      const admin = await this.adminRepo.findOne({
        where: { id: actor.sub },
        select: { id: true, passwordHash: true },
      });
      hash = admin?.passwordHash ?? null;
    } else if (actor.rol === "propietario") {
      const propietario = await this.propietarioRepo.findOne({
        where: { id: actor.sub },
        select: { id: true, passwordHash: true },
      });
      hash = propietario?.passwordHash ?? null;
    } else if (actor.rol === "gestor") {
      const gestor = await this.gestorRepo.findOne({
        where: { id: actor.sub },
        select: { id: true, passwordHash: true },
      });
      hash = gestor?.passwordHash ?? null;
    }
    if (!hash || !(await this.passwordService.compare(password, hash))) {
      throw new UnauthorizedException("La contraseña del operador es incorrecta");
    }
  }
}
