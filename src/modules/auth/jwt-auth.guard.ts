import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectDataSource } from "@nestjs/typeorm";
import type { Request } from "express";
import { DataSource } from "typeorm";
import { AdminUser } from "../admin-users/admin-user.entity";
import { Cobrador } from "../cobradores/cobrador.entity";
import { Socio } from "../socios/socio.entity";
import { AuthTokenPayload } from "./auth.service";

export const UNAUTHORIZED_GUARD_MESSAGE = "No autorizado";

/**
 * Valida el access token y revalida el estado del usuario en cada petición
 * (HU-05/HU-61): un usuario bloqueado (admin, socio o cobrador) deja de tener
 * acceso de inmediato, aunque su token aún no haya expirado.
 * La consulta se hace contra la tabla correspondiente según `rol` usando el
 * DataSource (disponible de forma global), evitando depender de repositorios
 * por módulo.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const header = request.headers.authorization;

    if (!header) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    if (payload.tipo !== "access") {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }

    await this.assertActivo(payload);

    request.user = payload;
    return true;
  }

  private async assertActivo(payload: AuthTokenPayload): Promise<void> {
    let activo = false;

    if (payload.rol === "admin") {
      const admin = await this.dataSource.getRepository(AdminUser).findOne({
        where: { id: payload.sub, estado: "activo" },
        select: { id: true },
      });
      activo = admin !== null;
    } else if (payload.rol === "socio") {
      const socio = await this.dataSource.getRepository(Socio).findOne({
        where: { id: payload.sub, estatus: "activo" },
        select: { id: true },
      });
      activo = socio !== null;
    } else if (payload.rol === "cobrador") {
      const cobrador = await this.dataSource.getRepository(Cobrador).findOne({
        where: { id: payload.sub, estatus: "activo" },
        select: { id: true },
      });
      activo = cobrador !== null;
    }

    if (!activo) {
      throw new UnauthorizedException(UNAUTHORIZED_GUARD_MESSAGE);
    }
  }
}