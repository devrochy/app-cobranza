import { ParadaGeo, segmentarTrayectos, calcularDistanciaKm } from "./segmentacion-trayectos";

describe("calcularDistanciaKm", () => {
  it("devuelve 0 para el mismo punto", () => {
    expect(calcularDistanciaKm(0, 0, 0, 0)).toBe(0);
  });

  it("calcula ~111 km para 1 grado de latitud", () => {
    const km = calcularDistanciaKm(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});

describe("segmentarTrayectos", () => {
  it("devuelve vacío sin paradas", () => {
    expect(segmentarTrayectos([], 9)).toEqual([]);
  });

  it("agrupa todas en un trayecto si hay <= maxParadas", () => {
    const paradas: ParadaGeo[] = [
      { clienteId: 1, latitud: -17.7, longitud: -63.1 },
      { clienteId: 2, latitud: -17.72, longitud: -63.12 },
      { clienteId: 3, latitud: -17.68, longitud: -63.09 },
    ];
    const result = segmentarTrayectos(paradas, 9);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it("respeta el máximo de paradas por trayecto", () => {
    // 25 paradas cercanas; con max 9 debe haber >= 3 trayectos y ninguno > 9.
    const paradas: ParadaGeo[] = [];
    for (let i = 0; i < 25; i++) {
      paradas.push({ clienteId: i + 1, latitud: -17.7 + i * 0.0001, longitud: -63.1 + i * 0.0001 });
    }
    const result = segmentarTrayectos(paradas, 9);
    expect(result.length).toBeGreaterThanOrEqual(3);
    result.forEach((trayecto) => {
      expect(trayecto.length).toBeLessThanOrEqual(9);
    });
  });

  it("cada trayecto contiene todas las paradas sin repetir", () => {
    const paradas: ParadaGeo[] = [];
    for (let i = 0; i < 20; i++) {
      paradas.push({ clienteId: i + 1, latitud: -17.7 + (i % 5) * 0.01, longitud: -63.1 + (i % 4) * 0.01 });
    }
    const result = segmentarTrayectos(paradas, 9);
    const ids = result.flat().map((p) => p.clienteId).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("la primera parada de un trayecto es la de menor latitud+longitud (ancla determinista)", () => {
    const paradas: ParadaGeo[] = [
      { clienteId: 1, latitud: -17.7, longitud: -63.1 },
      { clienteId: 2, latitud: -17.71, longitud: -63.11 },
      { clienteId: 3, latitud: -17.69, longitud: -63.09 },
    ];
    const result = segmentarTrayectos(paradas, 9);
    const ids = result[0].map((p) => p.clienteId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    // El ancla es el punto con menor latitud+longitud: cliente 2 (-17.71 + -63.11).
    expect(ids[0]).toBe(2);
  });

  it("con un punto de inicio, la primera parada es la más cercana al cobrador", () => {
    const paradas: ParadaGeo[] = [
      { clienteId: 1, latitud: -17.7, longitud: -63.1 },
      { clienteId: 2, latitud: -17.71, longitud: -63.11 },
      { clienteId: 3, latitud: -17.69, longitud: -63.09 },
    ];
    // El cobrador está pegado al cliente 3; el ancla determinista (cliente 2)
    // queda lejos, así que la ruta debe partir de la parada más cercana.
    const inicio = { latitud: -17.6901, longitud: -63.0901 };
    const result = segmentarTrayectos(paradas, 9, inicio);
    const ids = result[0].map((p) => p.clienteId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe(3);
  });

  it("con inicio y múltiples trayectos, visita primero el grupo más cercano al cobrador", () => {
    const norte: ParadaGeo[] = [];
    for (let i = 0; i < 6; i++) {
      norte.push({ clienteId: i + 1, latitud: 6.2 + i * 0.001, longitud: -75.5 });
    }
    const sur: ParadaGeo[] = [];
    for (let i = 0; i < 6; i++) {
      sur.push({ clienteId: i + 7, latitud: 5.0 + i * 0.001, longitud: -75.5 });
    }
    const inicio = { latitud: 6.2, longitud: -75.5 };
    const result = segmentarTrayectos([...sur, ...norte], 6, inicio);
    expect(result).toHaveLength(2);
    // El primer trayecto empieza en el punto más cercano al inicio (grupo norte).
    expect(result[0][0].latitud).toBe(6.2);
    expect(result[0][0].longitud).toBe(-75.5);
  });

  it("devuelve vacío si maxParadas es <= 0", () => {
    const paradas: ParadaGeo[] = [
      { clienteId: 1, latitud: -17.7, longitud: -63.1 },
      { clienteId: 2, latitud: -17.72, longitud: -63.12 },
    ];
    expect(segmentarTrayectos(paradas, 0)).toEqual([]);
    expect(segmentarTrayectos(paradas, -1)).toEqual([]);
  });
});