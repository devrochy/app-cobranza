import { SetMetadata } from "@nestjs/common";
import { SocioPermisoNombre } from "../socios/socio-permiso.entity";

export const PERMISO_REQUERIDO_KEY = "permiso_requerido";

export const PermisoRequerido = (permiso: SocioPermisoNombre) =>
  SetMetadata(PERMISO_REQUERIDO_KEY, permiso);
