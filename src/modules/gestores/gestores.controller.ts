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
import { PermisoGuard } from "../auth/permiso.guard";
import { ACCESO_DENEGADO } from "../../common/ownership";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { UpdateEstatusDto } from "../propietarios/dto/update-estatus.dto";
import { GestoresPermisosService } from "./gestores-permisos.service";
import { GestoresService } from "./gestores.service";
import { CreateGestorDto } from "./dto/create-gestor.dto";
import { UpdateGestorDto } from "./dto/update-gestor.dto";
import { UpdatePermisosGestorDto } from "./dto/update-permisos-gestor.dto";

@Controller("gestores")
export class GestoresController {
  constructor(
    private readonly gestoresService: GestoresService,
    private readonly gestoresPermisosService: GestoresPermisosService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_gestor")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(
    @Body() dto: CreateGestorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    if (req.user.rol === "propietario" && dto.propietarioId !== req.user.sub) {
      throw new ForbiddenException(ACCESO_DENEGADO);
    }
    return this.gestoresService.create(dto);
  }

  @Get()
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(@Req() req: Request & { user: AuthTokenPayload }) {
    const propietarioId = req.user.rol === "propietario" ? req.user.sub : undefined;
    return this.gestoresService.listar(propietarioId);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateGestorDto) {
    return this.gestoresService.update(id, dto);
  }

  @Patch(":id/estatus")
  @PermisoRequerido("bloquear_gestores")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstatusDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () =>
      this.gestoresService.setEstatus(id, dto.estatus),
    );
  }

  @Get(":id/permisos")
  @PermisoRequerido("editar_permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getPermisos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () => this.gestoresPermisosService.getMatriz(id));
  }

  @Put(":id/permisos")
  @PermisoRequerido("editar_permisos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setPermisos(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePermisosGestorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.withOwnership(id, req, () =>
      this.gestoresPermisosService.setMatriz(id, dto.matriz),
    );
  }

  private withOwnership<T>(
    gestorId: number,
    req: Request & { user: AuthTokenPayload },
    accion: () => Promise<T>,
  ): Promise<T> {
    const ejecutar = async (): Promise<T> => {
      if (req.user.rol === "propietario") {
        await this.gestoresPermisosService.assertOwnedByPropietario(gestorId, req.user.sub);
      }
      return accion();
    };
    return ejecutar();
  }
}
