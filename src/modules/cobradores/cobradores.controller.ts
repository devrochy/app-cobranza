import {
  Body,
  Controller,
  ForbiddenException,
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
import { ACCESO_DENEGADO, PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { UpdateEstatusDto } from "../socios/dto/update-estatus.dto";
import { CobradoresPermisosService } from "./cobradores-permisos.service";
import { CobradoresService } from "./cobradores.service";
import { CreateCobradorDto } from "./dto/create-cobrador.dto";
import { UpdateCobradorDto } from "./dto/update-cobrador.dto";
import { UpdatePermisosCobradorDto } from "./dto/update-permisos-cobrador.dto";

@Controller("cobradores")
export class CobradoresController {
  constructor(
    private readonly cobradoresService: CobradoresService,
    private readonly cobradoresPermisosService: CobradoresPermisosService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_cobrador")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(
    @Body() dto: CreateCobradorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    if (req.user.rol === "socio" && dto.socioId !== req.user.sub) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return this.cobradoresService.create(dto);
  }

  @Get()
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(@Req() req: Request & { user: AuthTokenPayload }) {
    const socioId = req.user.rol === "socio" ? req.user.sub : undefined;
    return this.cobradoresService.listar(socioId);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCobradorDto) {
    return this.cobradoresService.update(id, dto);
  }

  @Patch(":id/estatus")
  @PermisoRequerido("bloquear_cobradores")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstatusDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () =>
      this.cobradoresService.setEstatus(id, dto.estatus),
    );
  }

  @Get(":id/permisos")
  @PermisoRequerido("editar_permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getPermisos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () => this.cobradoresPermisosService.getMatriz(id));
  }

  @Put(":id/permisos")
  @PermisoRequerido("editar_permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setPermisos(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePermisosCobradorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () =>
      this.cobradoresPermisosService.setMatriz(id, dto.matriz),
    );
  }

  private withOwnership<T>(
    cobradorId: number,
    req: Request & { user: AuthTokenPayload },
    accion: () => Promise<T>,
  ): Promise<T> {
    const ejecutar = async (): Promise<T> => {
      if (req.user.rol === "socio") {
        await this.cobradoresPermisosService.assertOwnedBySocio(cobradorId, req.user.sub);
      }
      return accion();
    };
    return ejecutar();
  }
}
