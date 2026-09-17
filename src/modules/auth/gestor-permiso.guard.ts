import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { GestoresPermisosService } from "../gestores/gestores-permisos.service";
import { GestorPermisoNombre } from "../gestores/gestor-permiso.entity";
import { PermisosPropietarioService } from "../propietarios/permisos-propietario.service";
import { PropietarioPermisoNombre } from "../propietarios/propietario-permiso.entity";
import { AuthTokenPayload } from "./auth.service";
import { GESTOR_PERMISO_REQUERIDO_KEY } from "./gestor-permiso-requerido.decorator";
import { ACCESO_DENEGADO } from "../../common/ownership";

/**
 * Permiso de propietario equivalente al permiso de gestor solicitado. Si el permiso
 * del gestor no tiene equivalente en la matriz del propietario, se exige que el
 * propietario lo tenga mapeado explícitamente aquí (si no → 403).
 */
const PERMISO_GESTOR_A_PROPIETARIO: Partial<Record<GestorPermisoNombre, PropietarioPermisoNombre>> = {
  ver_cartera: "ver_reportes",
  registrar_pago: "configurar_cartera",
  registrar_abono: "configurar_cartera",
  registrar_no_pago: "configurar_cartera",
  registrar_prestamo: "configurar_cartera",
  registrar_gasto: "registrar_gasto",
  anotar_notas_cartera: "anotar_notas_cartera",
  actualizar_cliente: "actualizar_cliente",
  eliminar_abono: "eliminar_abono",
  eliminar_gasto: "eliminar_gastos",
  eliminar_prestamo: "eliminar_prestamos",
  eliminar_pago: "borrar_ultima_cuota",
  generar_reporte: "generar_reporte",
  registrar_inyeccion: "configurar_cartera",
};

/**
 * Autorización de endpoints del APK (gestor o propietario). Debe ejecutarse
 * después de JwtAuthGuard (que adjunta el payload y ya revalidó que el usuario
 * está activo).
 * - Rol gestor: necesita @GestorPermisoRequerido(X) con X habilitado en su
 *   matriz gestor_permisos.
 * - Rol propietario: necesita @GestorPermisoRequerido(X) con el equivalente de X
 *   habilitado en su matriz propietario_permisos (ver PERMISO_GESTOR_A_PROPIETARIO).
 * El ownership por cartera lo valida assertOwned en los servicios
 * (cartera.gestorId para gestor, cartera.propietarioId para propietario).
 */
@Injectable()
export class GestorPermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosGestor: GestoresPermisosService,
    private readonly permisosPropietario: PermisosPropietarioService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    const user = request.user;

    if (!user || (user.rol !== "gestor" && user.rol !== "propietario")) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    const permisoRequerido =
      this.reflector.getAllAndOverride<GestorPermisoNombre | undefined>(
        GESTOR_PERMISO_REQUERIDO_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!permisoRequerido) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    if (user.rol === "gestor") {
      const tienePermiso = await this.permisosGestor.tienePermiso(
        user.sub,
        permisoRequerido,
      );
      if (!tienePermiso) {
        throw new ForbiddenException(ACCESO_DENEGADO);
      }
      return true;
    }

    const permisoPropietario = PERMISO_GESTOR_A_PROPIETARIO[permisoRequerido];
    if (!permisoPropietario) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    const tienePermiso = await this.permisosPropietario.tienePermiso(user.sub, permisoPropietario);
    if (!tienePermiso) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return true;
  }
}