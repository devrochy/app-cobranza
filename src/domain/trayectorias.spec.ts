import { TrayectoGeo, trayectoriasAGeoJSON } from "./trayectorias";

describe("trayectoriasAGeoJSON", () => {
  it("devuelve una FeatureCollection vacía sin trayectos", () => {
    const fc = trayectoriasAGeoJSON([]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toEqual([]);
  });

  it("convierte cada trayecto en un Feature LineString con coordenadas [lng, lat]", () => {
    const trayectos: TrayectoGeo[] = [
      [
        { latitud: -17.78, longitud: -63.18 },
        { latitud: -17.79, longitud: -63.19 },
      ],
    ];
    const fc = trayectoriasAGeoJSON(trayectos);

    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe("LineString");
    expect(fc.features[0].geometry.coordinates).toEqual([
      [-63.18, -17.78],
      [-63.19, -17.79],
    ]);
  });

  it("genera un Feature por cada trayecto", () => {
    const trayectos: TrayectoGeo[] = [
      [{ latitud: -17.78, longitud: -63.18 }],
      [{ latitud: -17.8, longitud: -63.2 }],
    ];
    const fc = trayectoriasAGeoJSON(trayectos);
    expect(fc.features).toHaveLength(2);
  });
});