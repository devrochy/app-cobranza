import { SetMetadata } from "@nestjs/common";
import { GestorPermisoNombre } from "../gestores/gestor-permiso.entity";

export const GESTOR_PERMISO_REQUERIDO_KEY = "gestor_permiso_requerido";

export const GestorPermisoRequerido = (permiso: GestorPermisoNombre) =>
  SetMetadata(GESTOR_PERMISO_REQUERIDO_KEY, permiso);