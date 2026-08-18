import { fromPoint, toPoint } from "./geo";

describe("geo helpers", () => {
  describe("toPoint", () => {
    it("convierte lat/lng a GeoJSON Point (coordinates = [lng, lat])", () => {
      expect(toPoint(-17.78, -63.18)).toEqual({
        type: "Point",
        coordinates: [-63.18, -17.78],
      });
    });
  });

  describe("fromPoint", () => {
    it("convierte GeoJSON Point a lat/lng", () => {
      expect(fromPoint({ type: "Point", coordinates: [-63.18, -17.78] })).toEqual({
        latitud: -17.78,
        longitud: -63.18,
      });
    });
  });

  it("preserva los valores decimales en la conversión de lectura", () => {
    const { latitud, longitud } = fromPoint({ type: "Point", coordinates: [-63.18, -17.78] });
    expect(latitud).toBe(-17.78);
    expect(longitud).toBe(-63.18);
  });
});
