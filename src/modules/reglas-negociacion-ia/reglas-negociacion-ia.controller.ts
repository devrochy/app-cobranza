import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { GuardarReglasNegociacionIaDto } from "./dto/guardar-reglas-negociacion-ia.dto";
import { ReglasNegociacionIaService } from "./reglas-negociacion-ia.service";

@Controller("reglas-negociacion-ia")
export class ReglasNegociacionIaController {
  constructor(private readonly service: ReglasNegociacionIaService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  obtener() {
    return this.service.obtener();
  }

  @Put()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  guardar(
    @Body() dto: GuardarReglasNegociacionIaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.service.guardar(
      {
        maxDiasProrroga: dto.maxDiasProrroga,
        minAbonoAceptablePct: dto.minAbonoAceptablePct,
        maxReprogramacionesPorCliente: dto.maxReprogramacionesPorCliente,
        umbralSaldoAutonomo: dto.umbralSaldoAutonomo,
      },
      req.user.sub,
    );
  }
}
