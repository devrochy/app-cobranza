import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { PropietarioPermisoNombre } from "../propietarios/propietario-permiso.entity";
import { AuthTokenPayload } from "./auth.service";
import { PERMISO_REQUERIDO_KEY } from "./permiso-requerido.decorator";
import { ACCESO_DENEGADO } from "../../common/ownership";

/**
 * Autorización por rol/permiso. Debe ejecutarse después de JwtAuthGuard
 * (que adjunta el payload en request.user).
 * - Sin @PermisoRequerido en la cartera: solo rol admin.
 * - Con @PermisoRequerido(X): admin pasa siempre; propietario necesita X habilitado
 *   en su matriz propietario_permisos (si no → 403). Los gestores se autorizan con
 *   GestorPermisoGuard (ver src/modules/auth/gestor-permiso.guard.ts).
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosPropietario: PermisosPropietarioService,
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
      this.reflector.getAllAndOverride<PropietarioPermisoNombre | undefined>(
        PERMISO_REQUERIDO_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (user.rol === "admin") {
      return true;
    }
    if (user.rol !== "propietario") {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    if (!permisoRequerido) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const tienePermiso = await this.permisosPropietario.tienePermiso(
      user.sub,
      permisoRequerido,
    );
    if (!tienePermiso) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return true;
  }
}