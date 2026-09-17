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
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { GestorPermisoGuard } from "../auth/gestor-permiso.guard";
import { GestorPermisoRequerido } from "../auth/gestor-permiso-requerido.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClienteEvidenciaInput } from "../clientes/cliente.service";
import { RegistrarVisitaDto } from "../clientes/dto/registrar-visita.dto";
import { CreatePrestamoDto } from "../clientes/dto/create-prestamo.dto";
import { CreateClienteDto } from "../clientes/dto/create-cliente.dto";
import { ActualizarClienteDto } from "../clientes/dto/actualizar-cliente.dto";
import { CrearNotaDto } from "../carteras/dto/crear-nota.dto";
import { GenerarLiquidacionDto } from "../carteras/dto/generar-liquidacion.dto";
import { EditarCuotaDto } from "../clientes/dto/editar-cuota.dto";
import { OperacionAuditadaDto } from "../clientes/dto/operacion-auditada.dto";
import { RegistrarGastoDto } from "../carteras/dto/registrar-gasto.dto";
import { UpdateCarteraDto } from "../carteras/dto/update-cartera.dto";
import { UpdateCarteraConfigDto } from "../carteras/dto/update-cartera-config.dto";
import { RegistrarAperturaDto } from "../carteras/dto/registrar-apertura.dto";
import { RegistrarPosicionDto } from "../carteras/dto/registrar-posicion.dto";
import { RegistrarTrayectoriaRealDto } from "../carteras/dto/registrar-trayectoria-real.dto";
import { evidenciasMulterOptions } from "../carteras/evidencia-upload";
import { clienteFotosMulterOptions } from "../clientes/cliente-foto-upload";
import { RequesterOwned } from "../../common/ownership";
import { EstadisticasCarteraService } from "../carteras/estadisticas-cartera.service";
import { GestorService } from "./gestor.service";

/**
 * API del APK del gestor (modo en línea). Autenticación: JwtAuthGuard
 * (rol gestor + estado revalidado) + GestorPermisoGuard (matriz
 * gestor_permisos). El ownership por cartera lo valida assertOwned en los
 * servicios de dominio (cartera.gestorId).
 */
@Controller("gestor")
@UseGuards(JwtAuthGuard, GestorPermisoGuard)
export class GestorController {
  constructor(
    private readonly gestorService: GestorService,
    private readonly estadisticasCarteraService: EstadisticasCarteraService,
  ) {}

  private requester(req: Request & { user: AuthTokenPayload }): RequesterOwned {
    return { rol: req.user.rol, sub: req.user.sub };
  }

  @Get("mis-carteras")
  @GestorPermisoRequerido("ver_cartera")
  misCarteras(@Req() req: Request & { user: AuthTokenPayload }) {
    return this.gestorService.misCarteras(this.requester(req));
  }

  @Patch("carteras/:carteraId")
  @GestorPermisoRequerido("actualizar_cartera")
  @UseGuards(JwtAuthGuard, GestorPermisoGuard)
  actualizarCartera(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: UpdateCarteraDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.actualizarCartera(carteraId, dto, this.requester(req));
  }

  @Patch("carteras/:carteraId/configuracion")
  @GestorPermisoRequerido("actualizar_cartera")
  @UseGuards(JwtAuthGuard, GestorPermisoGuard)
  actualizarConfiguracionCartera(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: UpdateCarteraConfigDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.actualizarConfiguracionCartera(carteraId, dto, this.requester(req));
  }

  @Post("carteras/:carteraId/posicion")
  @GestorPermisoRequerido("ver_cartera")
  registrarPosicion(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarPosicionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarPosicion(
      carteraId,
      { latitud: dto.latitud, longitud: dto.longitud },
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/trayecto-diario")
  @GestorPermisoRequerido("ver_cartera")
  dia(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.dia(carteraId, this.requester(req));
  }

  @Get("carteras/:carteraId/estadisticas")
  @GestorPermisoRequerido("ver_cartera")
  estadisticas(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadisticasCarteraService.obtener(carteraId, this.requester(req));
  }

  @Post("carteras/:carteraId/trayecto")
  @GestorPermisoRequerido("ver_cartera")
  generarTrayecto(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.generarTrayecto(carteraId, this.requester(req));
  }

  @Post("carteras/:carteraId/apertura")
  @GestorPermisoRequerido("ver_cartera")
  registrarApertura(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarAperturaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarApertura(
      carteraId,
      { latitud: dto.latitud, longitud: dto.longitud },
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/visitas/pago")
  @GestorPermisoRequerido("registrar_pago")
  registrarVisitaPago(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarVisita(
      carteraId,
      { ...dto, resultado: "pago" },
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/visitas/no-pago")
  @GestorPermisoRequerido("registrar_no_pago")
  registrarVisitaNoPago(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarVisita(
      carteraId,
      { ...dto, resultado: "no_pago" },
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/gastos")
  @GestorPermisoRequerido("registrar_gasto")
  @UseInterceptors(FilesInterceptor("evidencias", 5, evidenciasMulterOptions))
  registrarGasto(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarGastoDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarGasto(
      carteraId,
      dto,
      files ?? [],
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/trayectoria-real")
  @GestorPermisoRequerido("generar_reporte")
  registrarTrayectoriaReal(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarTrayectoriaRealDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.registrarTrayectoriaReal(
      carteraId,
      dto.puntos,
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/prestamos")
  @GestorPermisoRequerido("registrar_prestamo")
  crearPrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: CreatePrestamoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const { fechaOtorgado, ...resto } = dto;
    return this.gestorService.crearPrestamo(
      carteraId,
      resto,
      this.requester(req),
      fechaOtorgado ? new Date(fechaOtorgado) : undefined,
    );
  }

  @Patch("carteras/:carteraId/cuotas/:cuotaId")
  @GestorPermisoRequerido("eliminar_pago")
  editarCuota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: EditarCuotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.editarCuota(
      carteraId,
      cuotaId,
      { valorEsperado: dto.valorEsperado, fechaVencimiento: dto.fechaVencimiento },
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Delete("carteras/:carteraId/cuotas/:cuotaId")
  @GestorPermisoRequerido("eliminar_pago")
  eliminarCuota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.eliminarCuota(
      carteraId,
      cuotaId,
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Delete("carteras/:carteraId/abonos/:abonoId")
  @GestorPermisoRequerido("eliminar_abono")
  eliminarAbono(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("abonoId", ParseIntPipe) abonoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.eliminarAbono(
      carteraId,
      abonoId,
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Delete("carteras/:carteraId/pagos/:pagoId")
  @GestorPermisoRequerido("eliminar_pago")
  eliminarPago(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("pagoId", ParseIntPipe) pagoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.eliminarPago(
      carteraId,
      pagoId,
      { password: dto.password, motivo: dto.motivo },
      this.requester(req),
    );
  }

  @Post("carteras/:carteraId/liquidaciones")
  @GestorPermisoRequerido("generar_reporte")
  generarLiquidacion(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: GenerarLiquidacionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.generarLiquidacion(
      carteraId,
      { comentario: dto.comentario },
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/liquidaciones")
  @GestorPermisoRequerido("generar_reporte")
  listarLiquidaciones(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.listarLiquidaciones(carteraId, this.requester(req));
  }

  @Get("carteras/:carteraId/liquidaciones/:liquidacionId/export-pdf")
  @GestorPermisoRequerido("generar_reporte")
  async exportarLiquidacionPdf(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("liquidacionId", ParseIntPipe) liquidacionId: number,
    @Req() req: Request & { user: AuthTokenPayload },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.gestorService.exportarLiquidacionPdf(
      carteraId,
      liquidacionId,
      this.requester(req),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get("carteras/:carteraId/clientes")
  @GestorPermisoRequerido("ver_cartera")
  listarClientesDeCartera(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.listarClientesDeCartera(carteraId, this.requester(req));
  }

  @Post("carteras/:carteraId/clientes")
  @GestorPermisoRequerido("actualizar_cliente")
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
  crearCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: CreateClienteDto,
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
    return this.gestorService.crearCliente(
      carteraId,
      dto,
      evidencias,
      this.requester(req),
    );
  }

  @Patch("carteras/:carteraId/clientes/:clienteId")
  @GestorPermisoRequerido("actualizar_cliente")
  actualizarCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: ActualizarClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.actualizarCliente(
      carteraId,
      clienteId,
      dto,
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/prestamos/:prestamoId/estado-cuenta")
  @GestorPermisoRequerido("ver_cartera")
  estadoCuentaPrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.obtenerEstadoCuentaPrestamo(
      carteraId,
      prestamoId,
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/prestamos/:prestamoId/cuotas/:cuotaId/detalle")
  @GestorPermisoRequerido("ver_cartera")
  detalleCuota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.obtenerDetalleCuota(
      carteraId,
      prestamoId,
      cuotaId,
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/clientes/:clienteId/tarjeta")
  @GestorPermisoRequerido("ver_cartera")
  obtenerTarjeta(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.obtenerTarjeta(carteraId, clienteId, this.requester(req));
  }

  @Post("carteras/:carteraId/clientes/:clienteId/evidencias")
  @GestorPermisoRequerido("actualizar_cliente")
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
    @Param("carteraId", ParseIntPipe) carteraId: number,
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
    return this.gestorService.agregarEvidenciasCliente(
      carteraId,
      clienteId,
      evidencias,
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/clientes/:clienteId/prestamos")
  @GestorPermisoRequerido("ver_cartera")
  listarPrestamosDeCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.listarPrestamosDeCliente(
      carteraId,
      clienteId,
      this.requester(req),
    );
  }

  @Get("carteras/:carteraId/notas")
  @GestorPermisoRequerido("anotar_notas_cartera")
  listarNotas(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.listarNotas(carteraId, this.requester(req));
  }

  @Post("carteras/:carteraId/notas")
  @GestorPermisoRequerido("anotar_notas_cartera")
  crearNota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: CrearNotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gestorService.crearNota(carteraId, dto.nota, this.requester(req));
  }
}