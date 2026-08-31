import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { CobradoresPermisosService } from "../cobradores/cobradores-permisos.service";
import { CobradorPermisoNombre } from "../cobradores/cobrador-permiso.entity";
import { AuthTokenPayload } from "./auth.service";
import { COBRADOR_PERMISO_REQUERIDO_KEY } from "./cobrador-permiso-requerido.decorator";

export const ACCESO_DENEGADO = "Acceso denegado";

/**
 * Autorización de endpoints del APK del cobrador. Debe ejecutarse después de
 * JwtAuthGuard (que adjunta el payload y ya revalidó que el cobrador está
 * activo).
 * - Solo rol cobrador; sin @CobradorPermisoRequerido en la ruta → 403.
 * - Con @CobradorPermisoRequerido(X): necesita X habilitado en su matriz
 *   cobrador_permisos (si no → 403).
 * El ownership por ruta (ruta.cobradorId) lo valida assertOwned en los
 * servicios (src/common/ownership.ts).
 */
@Injectable()
export class CobradorPermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosCobrador: CobradoresPermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const user = request.user;

    if (!user || user.rol !== "cobrador") {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const permisoRequerido =
      this.reflector.getAllAndOverride<CobradorPermisoNombre | undefined>(
        COBRADOR_PERMISO_REQUERIDO_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!permisoRequerido) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const tienePermiso = await this.permisosCobrador.tienePermiso(
      user.sub,
      permisoRequerido,
    );
    if (!tienePermiso) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return true;
  }
}