import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { ClienteService } from "./cliente.service";
import { ListarClientesGlobalDto } from "./dto/listar-clientes-global.dto";

@Controller("cartera")
export class CarteraGlobalController {
  constructor(private readonly clienteService: ClienteService) {}

  @Get("clientes")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarClientes(
    @Query() query: ListarClientesGlobalDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.listarGlobal(
      { rol: req.user.rol, sub: req.user.sub },
      query,
    );
  }
}