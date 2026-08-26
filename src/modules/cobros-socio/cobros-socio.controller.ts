import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { CobrosSocioService } from "./cobros-socio.service";
import { GenerarCobroSocioDto } from "./dto/generar-cobro-socio.dto";
import { ListarCobrosDto } from "./dto/listar-cobros.dto";
import { RegistrarPagoCobroDto } from "./dto/registrar-pago-cobro.dto";
import { NotificacionesSocioService } from "./notificaciones-socio.service";

/**
 * Cobro mensual a socios (HU-60). Admin-only: sin @PermisoRequerido, el
 * PermisoGuard deja pasar solo a rol admin (socio → 403).
 */
@Controller("cobros-socio")
export class CobrosSocioController {
  constructor(
    private readonly cobrosSocioService: CobrosSocioService,
    private readonly notificacionesSocioService: NotificacionesSocioService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(@Query() query: ListarCobrosDto) {
    return this.cobrosSocioService.listar(query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  obtener(@Param("id", ParseIntPipe) id: number) {
    return this.cobrosSocioService.obtener(id);
  }

  @Post("generar")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  generar(@Body() dto: GenerarCobroSocioDto) {
    return this.cobrosSocioService.generarCobro(dto.socioId, dto.periodo);
  }

  @Post(":id/pago")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async pagar(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RegistrarPagoCobroDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const cobro = await this.cobrosSocioService.registrarPago(id, {
      montoPagado: dto.montoPagado,
      metodoPago: dto.metodoPago,
      fechaPago: dto.fechaPago,
      registradoPor: req.user.sub,
    });
    await this.notificacionesSocioService.confirmarPago(id, dto.montoPagado);
    return cobro;
  }
}