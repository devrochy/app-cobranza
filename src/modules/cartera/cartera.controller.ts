import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { ClienteEvidenciaInput } from "./cliente.service";
import { clienteFotosMulterOptions } from "./cliente-foto-upload";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { CreatePrestamoDto } from "./dto/create-prestamo.dto";
import { RegistrarPagoDto } from "./dto/registrar-pago.dto";
import { RegistrarAbonoDto } from "./dto/registrar-abono.dto";
import { RegistrarVisitaDto } from "./dto/registrar-visita.dto";
import { ActualizarClienteDto } from "./dto/actualizar-cliente.dto";
import { DecisionCambioDto } from "./dto/decision-cambio.dto";

@Controller("rutas/:rutaId")
export class CarteraController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly prestamoService: PrestamoService,
    private readonly pagosService: PagosService,
    private readonly abonosService: AbonosService,
    private readonly visitasService: VisitasService,
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
}
