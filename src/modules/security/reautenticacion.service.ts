import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Socio } from "../socios/socio.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { RolUsuario } from "../auth/auth.service";
import { PasswordService } from "./password.service";

export interface ActorReautenticable {
  rol: RolUsuario;
  sub: number;
}

/**
 * Verifica la contraseña del operador (re-autenticación, HU-48) antes de
 * operaciones sensibles sobre cartera. Admin, socio y cobrador consultan su
 * propio hash.
 */
@Injectable()
export class ReautenticacionService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Socio)
    private readonly socioRepo: Repository<Socio>,
    @InjectRepository(Cobrador)
    private readonly cobradorRepo: Repository<Cobrador>,
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
    } else if (actor.rol === "socio") {
      const socio = await this.socioRepo.findOne({
        where: { id: actor.sub },
        select: { id: true, passwordHash: true },
      });
      hash = socio?.passwordHash ?? null;
    } else if (actor.rol === "cobrador") {
      const cobrador = await this.cobradorRepo.findOne({
        where: { id: actor.sub },
        select: { id: true, passwordHash: true },
      });
      hash = cobrador?.passwordHash ?? null;
    }
    if (!hash || !(await this.passwordService.compare(password, hash))) {
      throw new UnauthorizedException("La contraseña del operador es incorrecta");
    }
  }
}
