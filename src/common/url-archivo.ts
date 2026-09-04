/**
 * Normaliza un `rutaArchivo` guardado a una URL servible por el servidor
 * estático (/uploads/*). Multer guarda la ruta absoluta del filesystem en
 * `archivo.path` (p. ej. `/Users/.../uploads/clientes/foto.jpg`), que la APK
 * y el panel no pueden cargar como URL. Si el valor ya es servible
 * (empieza por `/uploads/` o es una URL http(s)), se devuelve tal cual.
 */
export function urlArchivoServible(rutaArchivo: string | null | undefined): string | null {
  if (!rutaArchivo) {
    return null;
  }
  if (
    rutaArchivo.startsWith("/uploads/") ||
    rutaArchivo.startsWith("http://") ||
    rutaArchivo.startsWith("https://")
  ) {
    return rutaArchivo;
  }
  const indice = rutaArchivo.indexOf("/uploads/");
  if (indice >= 0) {
    return rutaArchivo.slice(indice);
  }
  return rutaArchivo;
}