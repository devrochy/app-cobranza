import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { AuthTokenPayload } from "../auth/auth.service";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { ListarSociosDto } from "./dto/listar-socios.dto";
import { UpdateEstatusDto } from "./dto/update-estatus.dto";
import { UpdatePermisosDto } from "./dto/update-permisos.dto";
import { UpdateSocioDto } from "./dto/update-socio.dto";
import { ActualizarConfiguracionSocioDto } from "./dto/actualizar-configuracion-socio.dto";
import { PermisosSocioService } from "./permisos-socio.service";
import { SociosService } from "./socios.service";

@Controller("socios")
export class SociosController {
  constructor(
    private readonly sociosService: SociosService,
    private readonly permisosSocioService: PermisosSocioService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_socio")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(@Body() dto: CreateSocioDto) {
    return this.sociosService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSocioDto) {
    return this.sociosService.update(id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(@Query() query: ListarSociosDto) {
    return this.sociosService.listar(query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getById(@Param("id", ParseIntPipe) id: number) {
    return this.sociosService.obtener(id);
  }

  @Patch(":id/configuracion")
  @PermisoRequerido("editar_configuracion_socio")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarConfiguracion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ActualizarConfiguracionSocioDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.sociosService.actualizarConfiguracion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/estatus")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEstatusDto) {
    // Admin-only por decisión de HU-07: `bloquear_socio` no es accesible para
    // socios (evita DoS cross-tenant); el catálogo lo conserva para semántica futura.
    return this.sociosService.setEstatus(id, dto.estatus);
  }

  @Get(":id/permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getPermisos(@Param("id", ParseIntPipe) id: number) {
    return this.permisosSocioService.getMatriz(id);
  }

  @Put(":id/permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setPermisos(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePermisosDto) {
    return this.permisosSocioService.setMatriz(id, dto.matriz);
  }
}
