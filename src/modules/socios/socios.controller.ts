import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { UpdateEstatusDto } from "./dto/update-estatus.dto";
import { UpdatePermisosDto } from "./dto/update-permisos.dto";
import { UpdateSocioDto } from "./dto/update-socio.dto";
import { PermisosSocioService } from "./permisos-socio.service";
import { SociosService } from "./socios.service";

@Controller("socios")
export class SociosController {
  constructor(
    private readonly sociosService: SociosService,
    private readonly permisosSocioService: PermisosSocioService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSocioDto) {
    return this.sociosService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSocioDto) {
    return this.sociosService.update(id, dto);
  }

  @Patch(":id/estatus")
  @UseGuards(JwtAuthGuard)
  setEstatus(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEstatusDto) {
    return this.sociosService.setEstatus(id, dto.estatus);
  }

  @Get(":id/permisos")
  @UseGuards(JwtAuthGuard)
  getPermisos(@Param("id", ParseIntPipe) id: number) {
    return this.permisosSocioService.getMatriz(id);
  }

  @Put(":id/permisos")
  @UseGuards(JwtAuthGuard)
  setPermisos(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePermisosDto) {
    return this.permisosSocioService.setMatriz(id, dto.matriz);
  }
}
