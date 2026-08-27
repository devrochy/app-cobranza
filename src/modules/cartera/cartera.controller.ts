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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
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
import { clienteFotosMulterOptions } from "./cliente-foto-upload";
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

@Controller("rutas/:rutaId")
export class CarteraController {
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
  @PermisoRequerido("configurar_ruta")
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
    @Param("rutaId", ParseIntPipe) rutaId: number,
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
    return this.clienteService.crear(rutaId, dto, evidencias, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarClientes(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.listar(rutaId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes/:clienteId/prestamos")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarPrestamosDeCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.prestamoService.listarPorCliente(rutaId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("clientes/:clienteId/estatus")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatusCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: UpdateEstatusClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.setEstatus(rutaId, clienteId, dto.estatus, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("cambios-cliente")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarCambiosCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Query() query: ListarCambiosClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.listarCambios(rutaId, query.estado, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("prestamos")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: CreatePrestamoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const { fechaOtorgado, ...resto } = dto;
    return this.prestamoService.crear(
      rutaId,
      resto,
      {
        rol: req.user.rol,
        sub: req.user.sub,
      },
      fechaOtorgado ? new Date(fechaOtorgado) : undefined,
    );
  }

  @Post("pagos")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarPago(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarPagoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.pagosService.registrarPagoDeCuota(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("abonos")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarAbono(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarAbonoDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.abonosService.registrarAbono(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("visitas")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarVisita(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Body() dto: RegistrarVisitaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.visitasService.registrar(rutaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("clientes/:clienteId")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: ActualizarClienteDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.actualizar(rutaId, clienteId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("cambios-cliente/:cambioId/decision")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  decidirCambioCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("cambioId", ParseIntPipe) cambioId: number,
    @Body() dto: DecisionCambioDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteService.decidirPropuesta(
      rutaId,
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
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: EditarCuotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cuotaService.editarCuota(
      rutaId,
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
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("cuotaId", ParseIntPipe) cuotaId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cuotaService.eliminarCuota(
      rutaId,
      cuotaId,
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Delete("abonos/:abonoId")
  @PermisoRequerido("eliminar_abono")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarAbono(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("abonoId", ParseIntPipe) abonoId: number,
    @Body() dto: OperacionAuditadaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.abonosService.eliminarAbono(
      rutaId,
      abonoId,
      { password: dto.password, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Get("clientes/:clienteId/tarjeta")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  tarjetaCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.clienteTarjetaService.obtener(rutaId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("clientes/:clienteId/navegacion")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  navegacionCliente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Query() dto: OrigenNavegacionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.navegacionClienteService.obtener(
      rutaId,
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
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionChatService.obtenerHistorial(rutaId, clienteId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("clientes/:clienteId/conversacion/mensajes")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  enviarMensajeAgente(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("clienteId", ParseIntPipe) clienteId: number,
    @Body() dto: EnviarMensajeDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.conversacionChatService.enviarMensajeAgente(rutaId, clienteId, dto.contenido, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("prestamos/:prestamoId/estado-cuenta")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  estadoCuentaPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadoCuentaService.obtener(rutaId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post("prestamos/:prestamoId/enviar-reporte")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  enviarReportePrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadoCuentaService.enviarReporte(rutaId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("prestamos/:prestamoId/promesas")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarPromesasPrestamo(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("prestamoId", ParseIntPipe) prestamoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.promesasPagoService.listarPorPrestamo(rutaId, prestamoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch("promesas/:promesaId/estado")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  transicionarEstadoPromesa(
    @Param("rutaId", ParseIntPipe) rutaId: number,
    @Param("promesaId", ParseIntPipe) promesaId: number,
    @Body() dto: TransicionarEstadoPromesaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.promesasPagoService.transicionarEstado(
      rutaId,
      promesaId,
      { estado: dto.estado, motivo: dto.motivo },
      { rol: req.user.rol, sub: req.user.sub },
    );
  }
}
