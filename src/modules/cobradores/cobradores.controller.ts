import { Body, Controller, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CobradoresService } from "./cobradores.service";
import { CreateCobradorDto } from "./dto/create-cobrador.dto";
import { UpdateCobradorDto } from "./dto/update-cobrador.dto";

@Controller("cobradores")
export class CobradoresController {
  constructor(private readonly cobradoresService: CobradoresService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCobradorDto) {
    return this.cobradoresService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCobradorDto) {
    return this.cobradoresService.update(id, dto);
  }
}
