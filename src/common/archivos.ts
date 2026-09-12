import { Logger } from "@nestjs/common";
import { unlink } from "fs/promises";

const logger = new Logger("Archivos");

/**
 * Elimina archivos subidos por multer (best-effort). Se usa para limpiar
 * evidencias huérfanas cuando la operación que las referencia falla, evitando
 * dejar archivos en disco sin registro en la base de datos.
 */
export async function eliminarArchivosSubidos(
  paths: (string | undefined | null)[],
): Promise<void> {
  const unicos = [
    ...new Set(paths.filter((p): p is string => typeof p === "string" && p.length > 0)),
  ];
  await Promise.all(
    unicos.map(async (path) => {
      try {
        await unlink(path);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "ENOENT") {
          logger.warn(`No se pudo eliminar el archivo ${path}: ${String(err)}`);
        }
      }
    }),
  );
}
