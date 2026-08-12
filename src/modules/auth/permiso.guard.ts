import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { SocioPermisoNombre } from "../socios/socio-permiso.entity";
import { AuthTokenPayload } from "./auth.service";
import { PERMISO_REQUERIDO_KEY } from "./permiso-requerido.decorator";

export const ACCESO_DENEGADO = "Acceso denegado";

/**
 * Autorización por rol/permiso. Debe ejecutarse después de JwtAuthGuard
 * (que adjunta el payload en request.user).
 * - Sin @PermisoRequerido en la ruta: solo rol admin.
 * - Con @PermisoRequerido(X): admin pasa siempre; socio necesita X habilitado
 *   en su matriz socio_permisos (si no → 403).
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosSocio: PermisosSocioService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const permisoRequerido =
      this.reflector.getAllAndOverride<SocioPermisoNombre | undefined>(
        PERMISO_REQUERIDO_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (user.rol === "admin") {
      return true;
    }
    if (user.rol !== "socio") {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    if (!permisoRequerido) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const tienePermiso = await this.permisosSocio.tienePermiso(
      user.sub,
      permisoRequerido,
    );
    if (!tienePermiso) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return true;
  }
}
