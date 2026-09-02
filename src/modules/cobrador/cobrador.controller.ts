import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { CobradorPermisoGuard } from "../auth/cobrador-permiso.guard";
import { CobradorPermisoRequerido } from "../auth/cobrador-permiso-requerido.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClienteEvidenciaInput } from "../cartera/cliente.service";
import { RegistrarVisitaDto } from "../cartera/dto/registrar-visita.dto";
import { CreatePrestamoDto } from "../cartera/dto/create-prestamo.dto";
import { EditarCuotaDto } from "../cartera/dto/editar-cuota.dto";
import { OperacionAuditadaDto } from "../cartera/dto/operacion-auditada.dto";
import { RegistrarGastoDto } from "../rutas/dto/registrar-gasto.dto";
import { RegistrarAperturaDto } from "../rutas/dto/registrar-apertura.dto";
import { RegistrarTrayectoriaRealDto } from "../rutas/dto/registrar-trayectoria-real.dto";
import { evidenciasMulterOptions } from "../rutas/evidencia-upload";
import { clienteFotosMulterOptions } from "../cartera/cliente-foto-upload";
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

  @Post("rutas/:rutaId/trayecto")
  @CobradorPermisoRequerido("ver_cartera")
  generarTrayecto(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.generarTrayecto(rutaId, this.requester(req));
  }

  @Post("rutas/:rutaId/apertura")
  @CobradorPermisoRequerido("ver_cartera")
  registrarApertura(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarAperturaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.registrarApertura(
      rutaId,
      { latitud: dto.latitud, longitud: dto.longitud },
      this.requester(req),
    );
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

  @Post("rutas/:rutaId/prestamos")
  @CobradorPermisoRequerido("registrar_prestamo")
  crearPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: CreatePrestamoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const { fechaOtorgado, ...resto } = dto;
    return this.cobradorService.crearPrestamo(
      rutaId,
      resto,
      this.requester(req),
      fechaOtorgado ? new Date(fechaOtorgado) : undefined,
    );
  }

  @Patch("rutas/:rutaId/cuotas/:cuotaId")
  @CobradorPermisoRequerido("eliminar_pago")
  editarCuota(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: EditarCuotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.editarCuota(
      rutaId,
      cuotaId,
      { valorEsperado: dto.valorEsperado, fechaVencimiento: dto.fechaVencimiento },
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Delete("rutas/:rutaId/cuotas/:cuotaId")
  @CobradorPermisoRequerido("eliminar_pago")
  eliminarCuota(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.eliminarCuota(
      rutaId,
      cuotaId,
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Delete("rutas/:rutaId/abonos/:abonoId")
  @CobradorPermisoRequerido("eliminar_abono")
  eliminarAbono(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("abonoId", ParseIntPipe) abonoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.eliminarAbono(
      rutaId,
      abonoId,
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Get("rutas/:rutaId/clientes")
  @CobradorPermisoRequerido("ver_cartera")
  listarClientesDeRuta(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.listarClientesDeRuta(rutaId, this.requester(req));
  }

  @Get("rutas/:rutaId/prestamos/:prestamoId/estado-cuenta")
  @CobradorPermisoRequerido("ver_cartera")
  estadoCuentaPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.obtenerEstadoCuentaPrestamo(
      rutaId,
      prestamoId,
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

  @Post("rutas/:rutaId/clientes/:clienteId/evidencias")
  @CobradorPermisoRequerido("actualizar_cliente")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "foto_facial", maxCount: 1 },
        { name: "documento_frente", maxCount: 1 },
        { name: "documento_reverso", maxCount: 1 },
      ],
      clienteFotosMulterOptions,
    ),
  )
  agregarEvidenciasCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @UploadedFiles() files: {
      foto_facial?: Express.Multer.File[];
      documento_frente?: Express.Multer.File[];
      documento_reverso?: Express.Multer.File[];
    },
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const evidencias: ClienteEvidenciaInput[] = [];
    const mapa: Array<{
      campo: "foto_facial" | "documento_frente" | "documento_reverso";
      tipo: "foto_facial" | "documento_frente" | "documento_reverso";
    }> = [
      { campo: "foto_facial", tipo: "foto_facial" },
      { campo: "documento_frente", tipo: "documento_frente" },
      { campo: "documento_reverso", tipo: "documento_reverso" },
    ];
    for (const { campo, tipo } of mapa) {
      const lista = files?.[campo];
      if (lista && lista.length > 0) {
        evidencias.push({ tipo, archivo: lista[0] });
      }
    }
    return this.cobradorService.agregarEvidenciasCliente(
      rutaId,
      clienteId,
      evidencias,
      this.requester(req),
    );
  }

  @Get("rutas/:rutaId/clientes/:clienteId/prestamos")
  @CobradorPermisoRequerido("ver_cartera")
  listarPrestamosDeCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cobradorService.listarPrestamosDeCliente(
      rutaId,
      clienteId,
      this.requester(req),
    );
  }
}