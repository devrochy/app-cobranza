import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { evidenciasMulterOptions } from "./evidencia-upload";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { CreateRutaDto } from "./dto/create-ruta.dto";
import { CreateInyeccionDto } from "./dto/create-inyeccion.dto";
import { ReasignarCobradorDto } from "./dto/reasignar-cobrador.dto";
import { UpdateEstatusRutaDto } from "./dto/update-estatus-ruta.dto";
import { UpdateRutaConfigDto } from "./dto/update-ruta-config.dto";
import { UpdateRutaConfigMatrixDto } from "./dto/update-ruta-config-matrix.dto";
import { UpdateRutaDto } from "./dto/update-ruta.dto";
import { InyeccionesService } from "./inyecciones.service";
import { RutaConfigService } from "./ruta-config.service";
import { CajaService } from "./caja.service";
import { GastosService } from "./gastos.service";
import { RutasService } from "./rutas.service";
import { RegistrarGastoDto } from "./dto/registrar-gasto.dto";
import { CrearNotaDto } from "./dto/crear-nota.dto";
import { RutasNotasService } from "./rutas-notas.service";
import { GenerarLiquidacionDto } from "./dto/generar-liquidacion.dto";
import { LiquidacionesService } from "./liquidaciones.service";
import { RutasResumenService } from "./rutas-resumen.service";
import { RutaOptimizacionService } from "./ruta-optimizacion.service";
import { ListaClientesDelDiaService } from "./lista-clientes-dia.service";
import { TrayectoriasService } from "./trayectorias.service";
import { RegistrarTrayectoriaRealDto } from "./dto/registrar-trayectoria-real.dto";

@Controller("rutas")
export class RutasController {
  constructor(
    private readonly rutasService: RutasService,
    private readonly rutaConfigService: RutaConfigService,
    private readonly inyeccionesService: InyeccionesService,
    private readonly cajaService: CajaService,
    private readonly gastosService: GastosService,
    private readonly rutasNotasService: RutasNotasService,
    private readonly liquidacionesService: LiquidacionesService,
    private readonly rutasResumenService: RutasResumenService,
    private readonly rutaOptimizacionService: RutaOptimizacionService,
    private readonly listaClientesDelDiaService: ListaClientesDelDiaService,
    private readonly trayectoriasService: TrayectoriasService,
  ) {}

  @Post()
  @PermisoRequerido("registrar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  create(@Body() dto: CreateRutaDto, @Req() req: Request & { user: AuthTokenPayload }) {
    return this.rutasService.create(dto, { rol: req.user.rol, sub: req.user.sub });
  }

  @Post(":id/inyecciones")
  @PermisoRequerido("configurar_ruta")
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

  @Get(":id/ruta-config")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  getRutaConfig(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaConfigService.getMatriz(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Put(":id/ruta-config")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setRutaConfig(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaConfigMatrixDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaConfigService.setMatriz(id, dto, {
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
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarInformacion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.actualizarInformacion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/configuracion")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  actualizarConfiguracion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRutaConfigDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.actualizarConfiguracion(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/estatus")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  setEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstatusRutaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.setEstatus(id, dto.estatus, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/cobrador")
  @PermisoRequerido("configurar_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  reasignarCobrador(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReasignarCobradorDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasService.reasignarCobrador(id, dto.cobradorId, {
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
  @PermisoRequerido("anotar_notas_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  crearNota(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CrearNotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasNotasService.crear(id, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/notas")
  @PermisoRequerido("anotar_notas_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  listarNotas(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasNotasService.listar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Patch(":id/notas/:notaId")
  @PermisoRequerido("anotar_notas_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  editarNota(
    @Param("id", ParseIntPipe) id: number,
    @Param("notaId", ParseIntPipe) notaId: number,
    @Body() dto: CrearNotaDto,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasNotasService.editar(id, notaId, dto, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Delete(":id/notas/:notaId")
  @PermisoRequerido("anotar_notas_ruta")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  eliminarNota(
    @Param("id", ParseIntPipe) id: number,
    @Param("notaId", ParseIntPipe) notaId: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasNotasService.eliminar(id, notaId, {
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

  @Get(":id/resumen")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  resumenRuta(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutasResumenService.obtener(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Post(":id/dia/trayectos")
  @PermisoRequerido("generar_reporte")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  generarTrayectos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaOptimizacionService.generar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/dia/trayectos")
  @PermisoRequerido("ver_reportes")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  consultarTrayectos(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    return this.rutaOptimizacionService.consultar(id, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }

  @Get(":id/dia/clientes")
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

  @Get(":id/dia/mapa")
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

  @Post(":id/dia/trayectoria-real")
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

  @Get(":id/dia/trayectorias")
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
