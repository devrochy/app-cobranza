import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSocioDto } from "./dto/create-socio.dto";
import { SociosService } from "./socios.service";

@Controller("socios")
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSocioDto) {
    return this.sociosService.create(dto);
  }
}
