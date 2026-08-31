import { SetMetadata } from "@nestjs/common";
import { CobradorPermisoNombre } from "../cobradores/cobrador-permiso.entity";

export const COBRADOR_PERMISO_REQUERIDO_KEY = "cobrador_permiso_requerido";

export const CobradorPermisoRequerido = (permiso: CobradorPermisoNombre) =>
  SetMetadata(COBRADOR_PERMISO_REQUERIDO_KEY, permiso);