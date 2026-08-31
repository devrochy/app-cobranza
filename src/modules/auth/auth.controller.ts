import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService, AuthTokenPayload } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermisoGuard } from "./permiso.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.usuario, dto.password);
  }

  @Post("socio/login")
  loginSocio(@Body() dto: LoginDto) {
    return this.authService.loginSocio(dto.usuario, dto.password);
  }

  @Post("cobrador/login")
  loginCobrador(@Body() dto: LoginDto) {
    return this.authService.loginCobrador(dto.usuario, dto.password);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  me(@Req() req: Request & { user: AuthTokenPayload }) {
    return { id: req.user.sub, usuario: req.user.usuario };
  }
}
