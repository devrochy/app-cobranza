import { BadRequestException, Injectable } from "@nestjs/common";
import { mkdirSync, writeFileSync } from "fs";
import { extname, join } from "path";
import type { ArchivoSubido } from "../rutas/gastos.service";
import { UPLOAD_DIR } from "../rutas/evidencia-upload";

export interface EvidenciaOfflineInput {
  nombre: string;
  mimetype: string;
  base64: string;
}

const MAX_BYTES_POR_EVIDENCIA = 5 * 1024 * 1024;

/**
 * Persiste las evidencias de gasto enviadas offline (base64) a disco,
 * replicando el formato de `evidenciasMulterOptions` (ArchivoSubido) que
 * espera GastosService.registrar.
 */
@Injectable()
export class EvidenciasOfflineService {
  persistir(evidencias: EvidenciaOfflineInput[]): ArchivoSubido[] {
    return evidencias.map((evidencia) => {
      if (!MIMETYPES_PERMITIDOS.includes(evidencia.mimetype)) {
        throw new BadRequestException("La evidencia debe ser una imagen o PDF");
      }
      const buffer = Buffer.from(evidencia.base64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_BYTES_POR_EVIDENCIA) {
        throw new BadRequestException("Evidencia vacía o demasiado grande (máx 5MB)");
      }
      mkdirSync(UPLOAD_DIR, { recursive: true });
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(evidencia.nombre)}`;
      const path = join(UPLOAD_DIR, filename);
      writeFileSync(path, buffer);
      return {
        originalname: evidencia.nombre,
        mimetype: evidencia.mimetype,
        size: buffer.length,
        filename,
        path,
      };
    });
  }
}

const MIMETYPES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];