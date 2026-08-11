import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordService } from "../security/password.service";
import { AdminUser } from "./admin-user.entity";

/**
 * Bootstrap del primer administrador (seed). Reglas:
 * - Si ya existe al menos un admin, no hace nada.
 * - Si la tabla está vacía y faltan ADMIN_INITIAL_USERNAME/ADMIN_INITIAL_PASSWORD, avisa y salta.
 * - Si la tabla está vacía y hay credenciales, crea el admin con contraseña hasheada (nunca en claro).
 */
@Injectable()
export class AdminUserSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminUserSeedService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly repo: Repository<AdminUser>,
    private readonly config: ConfigService,
    private readonly password: PasswordService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    const existing = await this.repo.count();
    if (existing > 0) {
      return;
    }

    const username = this.config.get<string>("ADMIN_INITIAL_USERNAME");
    const password = this.config.get<string>("ADMIN_INITIAL_PASSWORD");

    if (!username || !password) {
      this.logger.warn(
        "No hay administradores y faltan ADMIN_INITIAL_USERNAME/ADMIN_INITIAL_PASSWORD. " +
          "Configúralos en .env para crear el primer admin (HU-01).",
      );
      return;
    }

    const passwordHash = await this.password.hash(password);
    const admin = this.repo.create({
      usuario: username,
      passwordHash,
      estado: "activo",
      nombre: null,
      apellido: null,
      correo: null,
      telefono: null,
    });
    await this.repo.save(admin);
    this.logger.log(`Administrador inicial '${username}' creado (seed).`);
  }
}
