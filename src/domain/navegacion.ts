export interface CoordenadaGeo {
  latitud: number;
  longitud: number;
}

export interface EnlacesNavegacion {
  googleMapsUrl: string;
  wazeUrl: string;
}

/**
 * HU-59: genera los deep links de navegación a Google Maps y Waze desde un
 * origen hasta un destino, a partir de coordenadas. No requiere API de pago
 * (solo la construcción de la URL); el dispositivo abre la app/web del mapa.
 * - Google Maps (Maps URLs, Directions): formato `lat,lng` en origin/destination.
 * - Waze usa formato `lat,lng`.
 */
export function generarEnlacesNavegacion(
  origen: CoordenadaGeo,
  destino: CoordenadaGeo,
): EnlacesNavegacion {
  const googleMapsUrl =
    `https://www.google.com/maps/dir/?api=1&origin=${origen.latitud},${origen.longitud}` +
    `&destination=${destino.latitud},${destino.longitud}`;

  const wazeUrl =
    `https://www.waze.com/ul?ll=${destino.latitud},${destino.longitud}&navigate=yes` +
    `&from=${origen.latitud},${origen.longitud}`;

  return { googleMapsUrl, wazeUrl };
}