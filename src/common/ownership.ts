import { ForbiddenException } from "@nestjs/common";
import { RolUsuario } from "../modules/auth/auth.service";

export const ACCESO_DENEGADO = "Acceso denegado";

export interface RequesterOwned {
  rol: RolUsuario;
  sub: number;
}

/**
 * Verifica que un requester propietario/gestor sea dueño del recurso (cartera) antes
 * de operar sobre él. Los administradores siempre pasan.
 * - propietario: la cartera debe pertenecer a su propietarioId.
 * - gestor: la cartera debe estar asignada a su gestorId (APK).
 */
export function assertOwned(
  cartera: { propietarioId: number; gestorId?: number },
  requester: RequesterOwned,
): void {
  if (requester.rol === "propietario" && cartera.propietarioId !== requester.sub) {
    throw new ForbiddenException(ACCESO_DENEGADO);
  }
  if (requester.rol === "gestor" && cartera.gestorId !== requester.sub) {
    throw new ForbiddenException(ACCESO_DENEGADO);
  }
}
