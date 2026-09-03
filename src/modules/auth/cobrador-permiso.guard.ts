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
import { PermisosSocioService } from "../socios/permisos-socio.service";
import { SocioPermisoNombre } from "../socios/socio-permiso.entity";
import { AuthTokenPayload } from "./auth.service";
import { COBRADOR_PERMISO_REQUERIDO_KEY } from "./cobrador-permiso-requerido.decorator";

export const ACCESO_DENEGADO = "Acceso denegado";

/**
 * Permiso de socio equivalente al permiso de cobrador solicitado. Si el permiso
 * del cobrador no tiene equivalente en la matriz del socio, se exige que el
 * socio lo tenga mapeado explícitamente aquí (si no → 403).
 */
const PERMISO_COBRADOR_A_SOCIO: Partial<Record<CobradorPermisoNombre, SocioPermisoNombre>> = {
  ver_cartera: "ver_reportes",
  registrar_pago: "configurar_ruta",
  registrar_abono: "configurar_ruta",
  registrar_no_pago: "configurar_ruta",
  registrar_prestamo: "configurar_ruta",
  registrar_gasto: "registrar_gasto",
  anotar_notas_ruta: "anotar_notas_ruta",
  actualizar_cliente: "actualizar_cliente",
  eliminar_abono: "eliminar_abono",
  eliminar_gasto: "eliminar_gastos",
  eliminar_prestamo: "eliminar_prestamos",
  eliminar_pago: "borrar_ultima_cuota",
  generar_reporte: "generar_reporte",
  registrar_inyeccion: "configurar_ruta",
};

/**
 * Autorización de endpoints del APK (cobrador o socio). Debe ejecutarse
 * después de JwtAuthGuard (que adjunta el payload y ya revalidó que el usuario
 * está activo).
 * - Rol cobrador: necesita @CobradorPermisoRequerido(X) con X habilitado en su
 *   matriz cobrador_permisos.
 * - Rol socio: necesita @CobradorPermisoRequerido(X) con el equivalente de X
 *   habilitado en su matriz socio_permisos (ver PERMISO_COBRADOR_A_SOCIO).
 * El ownership por ruta lo valida assertOwned en los servicios
 * (ruta.cobradorId para cobrador, ruta.socioId para socio).
 */
@Injectable()
export class CobradorPermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosCobrador: CobradoresPermisosService,
    private readonly permisosSocio: PermisosSocioService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const user = request.user;

    if (!user || (user.rol !== "cobrador" && user.rol !== "socio")) {
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

    if (user.rol === "cobrador") {
      const tienePermiso = await this.permisosCobrador.tienePermiso(
        user.sub,
        permisoRequerido,
      );
      if (!tienePermiso) {
        throw new ForbiddenException(ACCESO_DENEGADO);
      }
      return true;
    }

    const permisoSocio = PERMISO_COBRADOR_A_SOCIO[permisoRequerido];
    if (!permisoSocio) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    const tienePermiso = await this.permisosSocio.tienePermiso(user.sub, permisoSocio);
    if (!tienePermiso) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return true;
  }
}