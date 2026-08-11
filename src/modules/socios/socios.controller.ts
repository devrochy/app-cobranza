import { Body, Controller, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { UpdateEstatusDto } from "./dto/update-estatus.dto";
import { UpdateSocioDto } from "./dto/update-socio.dto";
import { SociosService } from "./socios.service";

@Controller("socios")
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

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
}
