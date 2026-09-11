import { existsSync, realpathSync, statSync } from "fs";
import { resolve, sep } from "path";
import { NotFoundException } from "@nestjs/common";

export interface DatosDescargaEvidencia {
  rutaArchivo: string;
  mimetype: string;
  nombreOriginal: string;
  /** Directorio dentro del cual debe vivir el archivo (anti path-traversal). */
  baseDir: string;
  descargar?: boolean;
}

export interface DescargaEvidenciaPreparada {
  rutaAbsoluta: string;
  headers: Record<string, string>;
}

const NOMBRE_POR_DEFECTO = "evidencia";

/** Interpreta el query `?descargar=` como bandera booleana. */
export function pideDescarga(valor: string | undefined): boolean {
  return valor === "1" || valor === "true";
}

/** Datos mínimos de una evidencia para poder descargarla. */
export interface EvidenciaArchivo {
  rutaArchivo: string;
  mimetype: string;
  nombreOriginal: string;
}

/**
 * Sanea el nombre para el parámetro `filename` (ASCII) del header
 * Content-Disposition: quita comillas, barras y caracteres de control, y
 * cualquier carácter no ASCII (que viaja en `filename*`).
 */
export function sanearNombreArchivo(nombre: string): string {
  const limpio = nombre
    .replace(/[\r\n"\\/]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
  return limpio.length > 0 ? limpio : NOMBRE_POR_DEFECTO;
}

/**
 * Valida que la evidencia exista y viva dentro de `baseDir`, y arma los headers
 * de una descarga segura (mimetype, inline/attachment, nosniff, sin cache).
 */
export function prepararDescargaEvidencia(
  datos: DatosDescargaEvidencia,
): DescargaEvidenciaPreparada {
  const objetivo = resolve(datos.rutaArchivo);
  const base = resolve(datos.baseDir);

  if (!estaDentro(objetivo, base)) {
    throw new NotFoundException("La evidencia no existe");
  }
  if (!existsSync(objetivo)) {
    throw new NotFoundException("La evidencia no existe");
  }

  // Resuelve symlinks para que un enlace dentro del base no escape a otra ruta.
  let real: string;
  try {
    real = realpathSync(objetivo);
  } catch {
    throw new NotFoundException("La evidencia no existe");
  }
  const baseReal = existsSync(base) ? realpathSync(base) : base;
  if (!estaDentro(real, baseReal) || !statSync(real).isFile()) {
    throw new NotFoundException("La evidencia no existe");
  }

  const disposicion = datos.descargar ? "attachment" : "inline";

  return {
    rutaAbsoluta: objetivo,
    headers: {
      "Content-Type": datos.mimetype,
      "Content-Disposition": `${disposicion}; filename="${sanearNombreArchivo(
        datos.nombreOriginal,
      )}"; filename*=UTF-8''${codificarNombreArchivo(datos.nombreOriginal)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  };
}

function estaDentro(objetivo: string, base: string): boolean {
  return objetivo === base || objetivo.startsWith(base + sep);
}

/** Codificación estricta RFC 5987 para `filename*` (encodeURIComponent deja `'()*`). */
function codificarNombreArchivo(nombre: string): string {
  return encodeURIComponent(nombre).replace(
    /['()*]/g,
    (caracter) => `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
