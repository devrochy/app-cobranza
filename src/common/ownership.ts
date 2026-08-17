import { ForbiddenException } from "@nestjs/common";
import { RolUsuario } from "../modules/auth/auth.service";

export const ACCESO_DENEGADO = "Acceso denegado";

export interface RequesterOwned {
  rol: RolUsuario;
  sub: number;
}

/**
 * Verifica que un requester socio sea dueño del recurso (ruta) antes de
 * operar sobre él. Los administradores siempre pasan; los cobradores se
 * autorizan por otro mecanismo (no alcanzan estos servicios aún).
 */
export function assertOwned(
  ruta: { socioId: number },
  requester: RequesterOwned,
): void {
  if (requester.rol === "socio" && ruta.socioId !== requester.sub) {
    throw new ForbiddenException(ACCESO_DENEGADO);
  }
}
