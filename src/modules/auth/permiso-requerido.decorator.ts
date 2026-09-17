import { SetMetadata } from "@nestjs/common";
import { PropietarioPermisoNombre } from "../propietarios/propietario-permiso.entity";

export const PERMISO_REQUERIDO_KEY = "permiso_requerido";

export const PermisoRequerido = (permiso: PropietarioPermisoNombre) =>
  SetMetadata(PERMISO_REQUERIDO_KEY, permiso);
