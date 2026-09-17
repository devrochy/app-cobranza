import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { CobrosPropietarioService } from "./cobros-propietario.service";
import { GenerarCobroPropietarioDto } from "./dto/generar-cobro-propietario.dto";
import { ListarCobrosDto } from "./dto/listar-cobros.dto";
import { RegistrarPagoCobroDto } from "./dto/registrar-pago-cobro.dto";
import { NotificacionesPropietarioService } from "./notificaciones-propietario.service";

/**
 * Cobro mensual a propietarios (HU-60). Admin-only: sin @PermisoRequerido, el
 * PermisoGuard deja pasar solo a rol admin (propietario → 403).
 */
@Controller("cobros-propietario")
export class CobrosPropietarioController {
  constructor(
    private readonly cobrosPropietarioService: CobrosPropietarioService,
    private readonly notificacionesPropietarioService: NotificacionesPropietarioService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(@Query() query: ListarCobrosDto) {
    return this.cobrosPropietarioService.listar(query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  obtener(@Param("id", ParseIntPipe) id: number) {
    return this.cobrosPropietarioService.obtener(id);
  }

  @Post("generar")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  generar(@Body() dto: GenerarCobroPropietarioDto) {
    return this.cobrosPropietarioService.generarCobro(dto.propietarioId, dto.periodo);
  }

  @Post(":id/pago")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async pagar(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RegistrarPagoCobroDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const cobro = await this.cobrosPropietarioService.registrarPago(id, {
      montoPagado: dto.montoPagado,
      metodoPago: dto.metodoPago,
      fechaPago: dto.fechaPago,
      registradoPor: req.user.sub,
    });
    await this.notificacionesPropietarioService.confirmarPago(id, dto.montoPagado);
    return cobro;
  }
}