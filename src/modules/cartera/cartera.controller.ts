import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { ClienteService } from "./cliente.service";
import { PrestamoService } from "./prestamo.service";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { CreatePrestamoDto } from "./dto/create-prestamo.dto";

@Controller("rutas/:rutaId")
export class CarteraController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
  ) {}

  // MVP: admin-only (sin @PermisoRequerido). El cobrador vía APK y el socio
  // quedan diferidos a cuando exista la APK y se definan sus permisos.
  @Post("clientes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: CreateClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.crear(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("prestamos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: CreatePrestamoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.prestamoService.crear(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}
