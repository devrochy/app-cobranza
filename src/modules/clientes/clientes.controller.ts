import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { createReadStream } from "fs";
import type { Request, Response } from "express";
import { pideDescarga, prepararDescargaEvidencia } from "../../common/descarga-archivo";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { ClienteService } from "./cliente.service";
import { PrestamoService } from "./prestamo.service";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { VisitasService } from "./visitas.service";
import { CuotaService } from "./cuota.service";
import { ClienteEvidenciaInput } from "./cliente.service";
import { clienteFotosMulterOptions, CLIENTE_UPLOAD_DIR } from "./cliente-foto-upload";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { CreatePrestamoDto } from "./dto/create-prestamo.dto";
import { RegistrarPagoDto } from "./dto/registrar-pago.dto";
import { RegistrarAbonoDto } from "./dto/registrar-abono.dto";
import { RegistrarVisitaDto } from "./dto/registrar-visita.dto";
import { ActualizarClienteDto } from "./dto/actualizar-cliente.dto";
import { DecisionCambioDto } from "./dto/decision-cambio.dto";
import { ListarCambiosClienteDto } from "./dto/listar-cambios-cliente.dto";
import { UpdateEstatusClienteDto } from "./dto/update-estatus-cliente.dto";
import { EditarCuotaDto } from "./dto/editar-cuota.dto";
import { OperacionAuditadaDto } from "./dto/operacion-auditada.dto";
import { ClienteTarjetaService } from "./cliente-tarjeta.service";
import { NavegacionClienteService } from "./navegacion-cliente.service";
import { OrigenNavegacionDto } from "./dto/origen-navegacion.dto";
import { ConversacionChatService } from "./conversacion-chat.service";
import { EstadoCuentaService } from "./estado-cuenta.service";
import { PromesasPagoService } from "./promesas-pago.service";
import { TransicionarEstadoPromesaDto } from "./dto/transicionar-estado-promesa.dto";
import { EnviarMensajeDto } from "./dto/enviar-mensaje.dto";

@Controller("carteras/:carteraId")
export class ClientesController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
    private readonly visitasService: VisitasService,
    private readonly cuotaService: CuotaService,
    private readonly clienteTarjetaService: ClienteTarjetaService,
    private readonly navegacionClienteService: NavegacionClienteService,
    private readonly conversacionChatService: ConversacionChatService,
    private readonly estadoCuentaService: EstadoCuentaService,
    private readonly promesasPagoService: PromesasPagoService,
  ) {}

  @Post("clientes")
  @PermisoRequerido("configurar_cartera")
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
  @UseGuards(JwtAuthGuard, PermisoGuard)
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
    return this.clienteService.crear(carteraId, dto, evidencias, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarClientes(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.listar(carteraId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes/:clienteId/prestamos")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarPrestamosDeCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.prestamoService.listarPorCliente(carteraId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("clientes/:clienteId/estatus")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatusCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: UpdateEstatusClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.setEstatus(carteraId, clienteId, dto.estatus, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("cambios-cliente")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarCambiosCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Query() query: ListarCambiosClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.listarCambios(carteraId, query.estado, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("prestamos")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearPrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: CreatePrestamoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const { fechaOtorgado, ...resto } = dto;
    return this.prestamoService.crear(
      carteraId,
      resto,
      {
        rol: req.user.rol,
        sub: req.user.sub,
      },
      fechaOtorgado ? new Date(fechaOtorgado) : undefined,
    );
  }

  @Post("pagos")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarPago(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarPagoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.pagosService.registrarPagoDeCuota(carteraId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("abonos")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarAbono(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarAbonoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.abonosService.registrarAbono(carteraId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("visitas")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarVisita(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.visitasService.registrar(carteraId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("clientes/:clienteId")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: ActualizarClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.actualizar(carteraId, clienteId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("cambios-cliente/:cambioId/decision")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  decidirCambioCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("cambioId", ParseIntPipe) cambioId: number,
    @Body() dto: DecisionCambioDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.decidirPropuesta(
      carteraId,
      cambioId,
      dto.decision,
      {
        rol: req.user.rol,
        sub: req.user.sub,
      },
      dto.motivoRechazo,
    );
  }

  @Patch("cuotas/:cuotaId")
  @PermisoRequerido("borrar_ultima_cuota")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  editarCuota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: EditarCuotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cuotaService.editarCuota(
      carteraId,
      cuotaId,
      { valorEsperado: dto.valorEsperado, fechaVencimiento: dto.fechaVencimiento },
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Delete("cuotas/:cuotaId")
  @PermisoRequerido("borrar_ultima_cuota")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarCuota(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cuotaService.eliminarCuota(
      carteraId,
      cuotaId,
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Delete("abonos/:abonoId")
  @PermisoRequerido("eliminar_abono")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarAbono(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("abonoId", ParseIntPipe) abonoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.abonosService.eliminarAbono(
      carteraId,
      abonoId,
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Delete("pagos/:pagoId")
  @PermisoRequerido("eliminar_pago")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarPago(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("pagoId", ParseIntPipe) pagoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.pagosService.eliminarPago(
      carteraId,
      pagoId,
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Get("clientes/:clienteId/tarjeta")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  tarjetaCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteTarjetaService.obtener(carteraId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes/:clienteId/evidencias/:tipo")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async descargarEvidenciaCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Param("tipo") tipo: string,
    @Query("descargar") descargar: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const evidencia = await this.clienteTarjetaService.descargarEvidencia(
      carteraId,
      clienteId,
      tipo,
      { rol: req.user.rol, sub: req.user.sub },
    );
    const { carteraAbsoluta, headers } = prepararDescargaEvidencia({
      ...evidencia,
      baseDir: CLIENTE_UPLOAD_DIR,
      descargar: pideDescarga(descargar),
    });
    for (const [clave, valor] of Object.entries(headers)) {
      res.setHeader(clave, valor);
    }
    return new StreamableFile(createReadStream(carteraAbsoluta));
  }

  @Get("clientes/:clienteId/navegacion")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  navegacionCliente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Query() dto: OrigenNavegacionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.navegacionClienteService.obtener(
      carteraId,
      clienteId,
      { latitud: dto.origenLat, longitud: dto.origenLng },
      {
        rol: req.user.rol,
        sub: req.user.sub,
      },
    );
  }

  @Get("clientes/:clienteId/conversacion")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  historialConversacion(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionChatService.obtenerHistorial(carteraId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("clientes/:clienteId/conversacion/mensajes")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  enviarMensajeAgente(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: EnviarMensajeDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionChatService.enviarMensajeAgente(carteraId, clienteId, dto.contenido, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("prestamos/:prestamoId/estado-cuenta")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  estadoCuentaPrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadoCuentaService.obtener(carteraId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("prestamos/:prestamoId/enviar-reporte")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  enviarReportePrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadoCuentaService.enviarReporte(carteraId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("prestamos/:prestamoId/promesas")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarPromesasPrestamo(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.promesasPagoService.listarPorPrestamo(carteraId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("promesas/:promesaId/estado")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  transicionarEstadoPromesa(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @Param("promesaId", ParseIntPipe) promesaId: number,
    @Body() dto: TransicionarEstadoPromesaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.promesasPagoService.transicionarEstado(
      carteraId,
      promesaId,
      { estado: dto.estado, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }
}
