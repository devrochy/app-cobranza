import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CobradoresService } from "./cobradores.service";
import { CreateCobradorDto } from "./dto/create-cobrador.dto";

@Controller("cobradores")
export class CobradoresController {
  constructor(private readonly cobradoresService: CobradoresService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCobradorDto) {
    return this.cobradoresService.create(dto);
  }
}
