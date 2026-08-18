export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export function toPoint(latitud: number, longitud: number): GeoPoint {
  return { type: "Point", coordinates: [longitud, latitud] };
}

export function fromPoint(point: GeoPoint): { latitud: number; longitud: number } {
  return {
    latitud: point.coordinates[1],
    longitud: point.coordinates[0],
  };
}
