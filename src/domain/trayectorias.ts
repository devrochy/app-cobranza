export interface ParadaGeoJSON {
  latitud: number;
  longitud: number;
}

export type TrayectoGeo = ParadaGeoJSON[];

export interface GeoJSONLineString {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: number[][] };
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONLineString[];
}

/**
 * HU-49: convierte un array de trayectos (cada uno = lista de paradas con
 * lat/lng) en un GeoJSON FeatureCollection de LineStrings (una por trayecto),
 * con coordenadas `[lng, lat]` según el estándar GeoJSON.
 * `origen` ("planificada"|"real") se guarda en properties para distinguir las
 * features al consolidar (HU-38).
 */
export function trayectoriasAGeoJSON(
  trayectos: TrayectoGeo[],
  origen?: "planificada" | "real",
): GeoJSONFeatureCollection {
  const features: GeoJSONLineString[] = trayectos.map((trayecto, index) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: trayecto.map((p) => [p.longitud, p.latitud]),
    },
    properties: { origen: origen ?? null, trayecto: index },
  }));

  return { type: "FeatureCollection", features };
}