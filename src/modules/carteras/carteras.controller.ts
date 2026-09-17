import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { createReadStream } from "fs";
import type { Request, Response } from "express";
import { UPLOAD_DIR, evidenciasMulterOptions } from "./evidencia-upload";
import { pideDescarga, prepararDescargaEvidencia } from "../../common/descarga-archivo";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { CreateCarteraDto } from "./dto/create-cartera.dto";
import { ListarCarterasDto } from "./dto/listar-carteras.dto";
import { CreateInyeccionDto } from "./dto/create-inyeccion.dto";
import { ReasignarGestorDto } from "./dto/reasignar-gestor.dto";
import { UpdateEstatusCarteraDto } from "./dto/update-estatus-cartera.dto";
import { UpdateCarteraConfigDto } from "./dto/update-cartera-config.dto";
import { UpdateCarteraConfigMatrixDto } from "./dto/update-cartera-config-matrix.dto";
import { UpdateCarteraDto } from "./dto/update-cartera.dto";
import { InyeccionesService } from "./inyecciones.service";
import { CarteraConfigService } from "./cartera-config.service";
import { CajaService } from "./caja.service";
import { GastosService } from "./gastos.service";
import { CarterasService } from "./carteras.service";
import { RegistrarGastoDto } from "./dto/registrar-gasto.dto";
import { CrearNotaDto } from "./dto/crear-nota.dto";
import { CarterasNotasService } from "./carteras-notas.service";
import { GenerarLiquidacionDto } from "./dto/generar-liquidacion.dto";
import { LiquidacionesService } from "./liquidaciones.service";
import { CarterasResumenService } from "./carteras-resumen.service";
import { EstadisticasCarteraService } from "./estadisticas-cartera.service";
import { ReportesDiariosService } from "./reportes-diarios.service";
import { CarteraOptimizacionService } from "./cartera-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { TrayectoriasService } from "./trayectorias.service";
import { RegistrarTrayectoriaRealDto } from "./dto/registrar-trayectoria-real.dto";
import { PosicionGestorService } from "./posicion-gestor.service";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida el formato YYYY-MM-DD de los query params de fecha (400 si no). */
function validarFecha(valor: string | undefined, campo: string): string | null {
  if (valor === undefined || valor === "") {
    return null;
  }
  if (!FECHA_RE.test(valor)) {
    throw new BadRequestException(`${campo} debe tener formato YYYY-MM-DD`);
  }
  return valor;
}

@Controller("carteras")
export class CarterasController {
  constructor(
    private readonly carterasService: CarterasService,
    private readonly carteraConfigService: CarteraConfigService,
    private readonly inyeccionesService: InyeccionesService,
    private readonly cajaService: CajaService,
    private readonly gastosService: GastosService,
    private readonly carterasNotasService: CarterasNotasService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly carterasResumenService: CarterasResumenService,
    private readonly estadisticasCarteraService: EstadisticasCarteraService,
    private readonly reportesDiariosService: ReportesDiariosService,
    private readonly carteraOptimizacionService: CarteraOptimizacionService,
    private readonly listaClientesDelDiaService: ListaClientesDelDiaService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly posicionService: PosicionGestorService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(@Body() dto: CreateCarteraDto, @Req() req: Request & { user: AuthTokenPayload }) {
    return this.carterasService.create(dto, { rol: req.user.rol, sub: req.user.sub });
  }

  @Get()
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listar(
    @Query() query: ListarCarterasDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasService.listar(query, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get("posiciones")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  posiciones(
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.posicionService.ultimasDelPropietario(req.user.sub, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/inyecciones")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearInyeccion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateInyeccionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.inyeccionesService.crear(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Delete(":id/inyecciones/:inyeccionId")
  @PermisoRequerido("eliminar_inyeccion")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarInyeccion(
    @Param("id", ParseIntPipe) id: number,
    @Param("inyeccionId", ParseIntPipe) inyeccionId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.inyeccionesService.eliminar(id, inyeccionId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/inyecciones")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarInyecciones(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.inyeccionesService.listar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/cartera-config")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getCarteraConfig(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carteraConfigService.getMatriz(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Put(":id/cartera-config")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setCarteraConfig(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCarteraConfigMatrixDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carteraConfigService.setMatriz(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/caja")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getCaja(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.cajaService.consultar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarInformacion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCarteraDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasService.actualizarInformacion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/configuracion")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarConfiguracion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCarteraConfigDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasService.actualizarConfiguracion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/estatus")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstatusCarteraDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasService.setEstatus(id, dto.estatus, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/gestor")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  reasignarGestor(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReasignarGestorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasService.reasignarGestor(id, dto.gestorId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/gastos")
  @PermisoRequerido("registrar_gasto")
  @UseInterceptors(FilesInterceptor("evidencias", 5, evidenciasMulterOptions))
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarGasto(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RegistrarGastoDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gastosService.registrar(id, dto, files ?? [], {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/gastos")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarGastos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gastosService.listar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/gastos/:gastoId/evidencias/:evidenciaId")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async descargarEvidenciaGasto(
    @Param("id", ParseIntPipe) id: number,
    @Param("gastoId", ParseIntPipe) gastoId: number,
    @Param("evidenciaId", ParseIntPipe) evidenciaId: number,
    @Query("descargar") descargar: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const evidencia = await this.gastosService.descargarEvidencia(id, gastoId, evidenciaId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
    const { carteraAbsoluta, headers } = prepararDescargaEvidencia({
      ...evidencia,
      baseDir: UPLOAD_DIR,
      descargar: pideDescarga(descargar),
    });
    for (const [clave, valor] of Object.entries(headers)) {
      res.setHeader(clave, valor);
    }
    return new StreamableFile(createReadStream(carteraAbsoluta));
  }

  @Patch(":id/gastos/:gastoId/aprobar")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  aprobarGasto(
    @Param("id", ParseIntPipe) id: number,
    @Param("gastoId", ParseIntPipe) gastoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gastosService.aprobar(id, gastoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Delete(":id/gastos/:gastoId")
  @PermisoRequerido("eliminar_gastos")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarGasto(
    @Param("id", ParseIntPipe) id: number,
    @Param("gastoId", ParseIntPipe) gastoId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.gastosService.eliminar(id, gastoId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/notas")
  @PermisoRequerido("anotar_notas_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearNota(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CrearNotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasNotasService.crear(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/notas")
  @PermisoRequerido("anotar_notas_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarNotas(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasNotasService.listar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/notas/:notaId")
  @PermisoRequerido("anotar_notas_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  editarNota(
    @Param("id", ParseIntPipe) id: number,
    @Param("notaId", ParseIntPipe) notaId: number,
    @Body() dto: CrearNotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasNotasService.editar(id, notaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Delete(":id/notas/:notaId")
  @PermisoRequerido("anotar_notas_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarNota(
    @Param("id", ParseIntPipe) id: number,
    @Param("notaId", ParseIntPipe) notaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasNotasService.eliminar(id, notaId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/liquidaciones")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  generarLiquidacion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: GenerarLiquidacionDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.liquidacionesService.generar(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/liquidaciones")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarLiquidaciones(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.liquidacionesService.listar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/liquidaciones/:liquidacionId/export")
  @PermisoRequerido("descargar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async exportarLiquidacion(
    @Param("id", ParseIntPipe) id: number,
    @Param("liquidacionId", ParseIntPipe) liquidacionId: number,
    @Req() req: Request & { user: AuthTokenPayload },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.liquidacionesService.exportar(id, liquidacionId, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(":id/reporte-trayecto-diario")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  reporteDia(
    @Param("id", ParseIntPipe) id: number,
    @Query("fecha") fecha: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    const fechaValidada = validarFecha(fecha, "fecha");
    return this.reportesDiariosService.reporteDia(
      id,
      fechaValidada ?? this.reportesDiariosService.fechaDeHoy(),
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Get(":id/reportes-trayecto-diario")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  historialReportesDiarios(
    @Param("id", ParseIntPipe) id: number,
    @Query("desde") desde: string | undefined,
    @Query("hasta") hasta: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.reportesDiariosService.historial(
      id,
      validarFecha(desde, "desde"),
      validarFecha(hasta, "hasta"),
      { rol: req.user.rol, sub: req.user.sub },
    );
  }

  @Get(":id/reportes-trayecto-diario/export")
  @PermisoRequerido("descargar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  async exportarReportesDiarios(
    @Param("id", ParseIntPipe) id: number,
    @Query("desde") desde: string | undefined,
    @Query("hasta") hasta: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reportesDiariosService.exportarHistorial(
      id,
      validarFecha(desde, "desde"),
      validarFecha(hasta, "hasta"),
      { rol: req.user.rol, sub: req.user.sub },
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(":id/resumen")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  resumenCartera(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carterasResumenService.obtener(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/estadisticas")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  estadisticasCartera(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.estadisticasCarteraService.obtener(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/trayecto-diario/trayectos")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  generarTrayectos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carteraOptimizacionService.generar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/trayecto-diario/trayectos")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  consultarTrayectos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.carteraOptimizacionService.consultar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/trayecto-diario/clientes")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listaClientesDelDia(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.listaClientesDelDiaService.obtener(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/trayecto-diario/mapa")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  mapaClientesDelDia(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.listaClientesDelDiaService.obtenerMapa(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/trayecto-diario/trayectoria-real")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  registrarTrayectoriaReal(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RegistrarTrayectoriaRealDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.trayectoriasService.registrarReal(id, dto.puntos, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/trayecto-diario/trayectorias")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  consultarTrayectorias(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.trayectoriasService.consultar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}
