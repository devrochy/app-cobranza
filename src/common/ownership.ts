import { ForbiddenException } from "@nestjs/common";
import { RolUsuario } from "../modules/auth/auth.service";

export const ACCESO_DENEGADO = "Acceso denegado";

export interface RequesterOwned {
  rol: RolUsuario;
  sub: number;
}

/**
 * Verifica que un requester socio/cobrador sea dueño del recurso (ruta) antes
 * de operar sobre él. Los administradores siempre pasan.
 * - socio: la ruta debe pertenecer a su socioId.
 * - cobrador: la ruta debe estar asignada a su cobradorId (APK).
 */
export function assertOwned(
  ruta: { socioId: number; cobradorId?: number },
  requester: RequesterOwned,
): void {
  if (requester.rol === "socio" && ruta.socioId !== requester.sub) {
    throw new ForbiddenException(ACCESO_DENEGADO);
  }
  if (requester.rol === "cobrador" && ruta.cobradorId !== requester.sub) {
    throw new ForbiddenException(ACCESO_DENEGADO);
  }
}
