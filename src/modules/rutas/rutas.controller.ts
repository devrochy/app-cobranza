import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { CreateRutaDto } from "./dto/create-ruta.dto";
import { ReasignarCobradorDto } from "./dto/reasignar-cobrador.dto";
import { UpdateEstatusRutaDto } from "./dto/update-estatus-ruta.dto";
import { UpdateRutaConfigDto } from "./dto/update-ruta-config.dto";
import { UpdateRutaConfigMatrixDto } from "./dto/update-ruta-config-matrix.dto";
import { UpdateRutaDto } from "./dto/update-ruta.dto";
import { RutaConfigService } from "./ruta-config.service";
import { RutasService } from "./rutas.service";

@Controller("rutas")
export class RutasController {
  constructor(
    private readonly rutasService: RutasService,
    private readonly rutaConfigService: RutaConfigService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(@Body() dto: CreateRutaDto, @Req() req: Request & { user: AuthTokenPayload }) {
    return this.rutasService.create(dto, { rol: req.user.rol, sub: req.user.sub });
  }

  @Get(":id/ruta-config")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getRutaConfig(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaConfigService.getMatriz(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Put(":id/ruta-config")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setRutaConfig(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaConfigMatrixDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaConfigService.setMatriz(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarInformacion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.actualizarInformacion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/configuracion")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarConfiguracion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaConfigDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.actualizarConfiguracion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/estatus")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstatusRutaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.setEstatus(id, dto.estatus, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/cobrador")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  reasignarCobrador(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReasignarCobradorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.reasignarCobrador(id, dto.cobradorId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}
