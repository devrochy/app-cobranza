import {
  BadRequestException,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import { AuthTokenPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermisoGuard } from "../auth/permiso.guard";
import { PermisoRequerido } from "../auth/permiso-requerido.decorator";
import { parsearCarteraXlsx } from "./importar-cartera.parser";
import { validarFilas } from "./importar-cartera.validacion";
import { ImportarCarteraService } from "./importar-cartera.service";

/**
 * Importación masiva de una cartera desde `cartera.xlsx`.
 * `?dryRun=true` valida sin escribir (vista previa del panel).
 */
@Controller("carteras/:carteraId")
export class ImportarCarteraController {
  constructor(private readonly importarCarteraService: ImportarCarteraService) {}

  @Post("importar")
  @PermisoRequerido("configurar_cartera")
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @UseInterceptors(
    FileInterceptor("archivo", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importar(
    @Param("carteraId", ParseIntPipe) carteraId: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Query("dryRun") dryRun: string | undefined,
    @Req() req: Request & { user: AuthTokenPayload },
  ) {
    if (!archivo) {
      throw new BadRequestException("Falta el archivo (cartera.xlsx)");
    }

    const { filas, fechaReporte } = await parsearCarteraXlsx(archivo.buffer);
    const validacion = validarFilas(filas);

    if (dryRun === "true") {
      return {
        total: validacion.total,
        conErrores: validacion.conErrores,
        errores: validacion.errores,
        fechaReporte,
        filas,
      };
    }

    if (validacion.conErrores > 0) {
      throw new BadRequestException({
        message: `Hay ${validacion.conErrores} filas con errores`,
        errores: validacion.errores,
      });
    }

    return this.importarCarteraService.importar(carteraId, filas, fechaReporte, {
      rol: req.user.rol,
      sub: req.user.sub,
    });
  }
}
