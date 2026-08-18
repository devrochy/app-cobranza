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
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { ClienteService } from "./cliente.service";
import { PrestamoService } from "./prestamo.service";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { CreatePrestamoDto } from "./dto/create-prestamo.dto";
import { RegistrarPagoDto } from "./dto/registrar-pago.dto";
import { RegistrarAbonoDto } from "./dto/registrar-abono.dto";

@Controller("rutas/:rutaId")
export class CarteraController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
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

  @Post("pagos")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarPago(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarPagoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.pagosService.registrarPagoDeCuota(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("abonos")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarAbono(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarAbonoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.abonosService.registrarAbono(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}
