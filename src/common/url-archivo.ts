/**
 * Normaliza un `carteraArchivo` guardado a una URL servible por el servidor
 * estático (/uploads/*). Multer guarda la cartera absoluta del filesystem en
 * `archivo.path` (p. ej. `/Users/.../uploads/clientes/foto.jpg`), que la APK
 * y el panel no pueden cargar como URL. Si el valor ya es servible
 * (empieza por `/uploads/` o es una URL http(s)), se devuelve tal cual.
 */
export function urlArchivoServible(carteraArchivo: string | null | undefined): string | null {
  if (!carteraArchivo) {
    return null;
  }
  if (
    carteraArchivo.startsWith("/uploads/") ||
    carteraArchivo.startsWith("http://") ||
    carteraArchivo.startsWith("https://")
  ) {
    return carteraArchivo;
  }
  const indice = carteraArchivo.indexOf("/uploads/");
  if (indice >= 0) {
    return carteraArchivo.slice(indice);
  }
  return carteraArchivo;
}