import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { CobradorPermisoGuard } from "../auth/cobrador-permiso.guard";
import { CobradorPermisoRequerido } from "../auth/cobrador-permiso-requerido.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RegistrarVisitaDto } from "../cartera/dto/registrar-visita.dto";
import { RegistrarGastoDto } from "../rutas/dto/registrar-gasto.dto";
import { RegistrarTrayectoriaRealDto } from "../rutas/dto/registrar-trayectoria-real.dto";
import { evidenciasMulterOptions } from "../rutas/evidencia-upload";
import { RequesterOwned } from "../../common/ownership";
import { CobradorService } from "./cobrador.service";

/**
 * API del APK del cobrador (modo en línea). Autenticación: JwtAuthGuard
 * (rol cobrador + estado revalidado) + CobradorPermisoGuard (matriz
 * cobrador_permisos). El ownership por ruta lo valida assertOwned en los
 * servicios de dominio (ruta.cobradorId).
 */
@Controller("cobrador")
@UseGuards(JwtAuthGuard, CobradorPermisoGuard)
export class CobradorController {
  constructor(private readonly cobradorService: CobradorService) {}

  private requester(req: Request & { user: AuthTokenPayload }): RequesterOwned {
    return { rol: req.user.rol, sub: req.user.sub };
  }

  @Get("mis-rutas")
  @CobradorPermisoRequerido("ver_cartera")
  misRutas(@Req() req: Request & { user: AuthTokenPayload }) {
    return this.cobradorService.misRutas(req.user.sub);
  }

  @Get("rutas/:rutaId/dia")
  @CobradorPermisoRequerido("ver_cartera")
  dia(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.dia(rutaId, this.requester(req));
  }

  @Post("rutas/:rutaId/visitas/pago")
  @CobradorPermisoRequerido("registrar_pago")
  registrarVisitaPago(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.registrarVisita(
      rutaId,
      { ...dto, resultado: "pago" },
      this.requester(req),
    );
  }

  @Post("rutas/:rutaId/visitas/no-pago")
  @CobradorPermisoRequerido("registrar_no_pago")
  registrarVisitaNoPago(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.registrarVisita(
      rutaId,
      { ...dto, resultado: "no_pago" },
      this.requester(req),
    );
  }

  @Post("rutas/:rutaId/gastos")
  @CobradorPermisoRequerido("registrar_gasto")
  @UseInterceptors(FilesInterceptor("evidencias", 5, evidenciasMulterOptions))
  registrarGasto(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarGastoDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.registrarGasto(
      rutaId,
      dto,
      files ?? [],
      this.requester(req),
    );
  }

  @Post("rutas/:rutaId/trayectoria-real")
  @CobradorPermisoRequerido("generar_reporte")
  registrarTrayectoriaReal(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarTrayectoriaRealDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.registrarTrayectoriaReal(
      rutaId,
      dto.puntos,
      this.requester(req),
    );
  }

  @Get("rutas/:rutaId/clientes/:clienteId/tarjeta")
  @CobradorPermisoRequerido("ver_cartera")
  obtenerTarjeta(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.obtenerTarjeta(rutaId, clienteId, this.requester(req));
  }
}