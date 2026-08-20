import { CoordenadaGeo, generarEnlacesNavegacion } from "./navegacion";

describe("generarEnlacesNavegacion", () => {
  const origen: CoordenadaGeo = { latitud: -17.77, longitud: -63.17 };
  const destino: CoordenadaGeo = { latitud: -17.78, longitud: -63.18 };

  it("genera el enlace de Google Maps con origen y destino (lat,lng)", () => {
    const { googleMapsUrl } = generarEnlacesNavegacion(origen, destino);
    expect(googleMapsUrl).toContain("google.com/maps/dir");
    expect(googleMapsUrl).toContain("origin=-17.77,-63.17");
    expect(googleMapsUrl).toContain("destination=-17.78,-63.18");
  });

  it("genera el enlace de Waze con las coordenadas del destino (lat,lng)", () => {
    const { wazeUrl } = generarEnlacesNavegacion(origen, destino);
    expect(wazeUrl).toContain("waze.com/ul");
    expect(wazeUrl).toContain("ll=-17.78,-63.18");
    expect(wazeUrl).toContain("navigate=yes");
  });
});