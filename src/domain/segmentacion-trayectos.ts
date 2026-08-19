export interface ParadaGeo {
  clienteId: number;
  latitud: number;
  longitud: number;
}

export type Trayecto = ParadaGeo[];

/**
 * Distancia en km entre dos puntos (fórmula de haversine sobre la esfera WGS84).
 * Se usa en memoria para el clustering/orden (determinista y testeable);
 * las distancias que requieran consultas geoespaciales en BD usan ST_Distance.
 */
export function calcularDistanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // radio terrestre en km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function distanciaEntre(a: ParadaGeo, b: ParadaGeo): number {
  return calcularDistanciaKm(a.latitud, a.longitud, b.latitud, b.longitud);
}

/**
 * Ordena las paradas de un grupo por vecino más cercano (greedy), empezando
 * por la parada de menor latitud+longitud (ancla determinista).
 */
function ordenarPorVecinoMasCercano(paradas: ParadaGeo[]): ParadaGeo[] {
  if (paradas.length <= 1) {
    return paradas;
  }
  const pendientes = [...paradas];
  pendientes.sort((a, b) => a.latitud + a.longitud - (b.latitud + b.longitud));
  const inicio = pendientes.shift()!;
  const ordenadas: ParadaGeo[] = [inicio];
  let actual = inicio;
  while (pendientes.length > 0) {
    let idxMin = 0;
    let dMin = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const d = distanciaEntre(actual, pendientes[i]);
      if (d < dMin) {
        dMin = d;
        idxMin = i;
      }
    }
    actual = pendientes[idxMin];
    ordenadas.push(actual);
    pendientes.splice(idxMin, 1);
  }
  return ordenadas;
}

function centroide(grupo: ParadaGeo[]): { latitud: number; longitud: number } {
  const lat = grupo.reduce((s, p) => s + p.latitud, 0) / grupo.length;
  const lng = grupo.reduce((s, p) => s + p.longitud, 0) / grupo.length;
  return { latitud: lat, longitud: lng };
}

/**
 * K-means simple con asignación por cercanía. Devuelve grupos de paradas
 * (no ordenados); cada grupo puede exceder maxParadas y se subdivide luego.
 */
function kMeans(paradas: ParadaGeo[], k: number): ParadaGeo[][] {
  const pts = [...paradas];
  // Inicialización determinista: los primeros k puntos como centroides.
  const centroides = pts.slice(0, Math.min(k, pts.length)).map((p) => ({
    latitud: p.latitud,
    longitud: p.longitud,
  }));
  let grupos: ParadaGeo[][] = [];
  for (let iter = 0; iter < 100; iter++) {
    grupos = Array.from({ length: centroides.length }, () => []);
    for (const p of pts) {
      let idx = 0;
      let dMin = Infinity;
      for (let i = 0; i < centroides.length; i++) {
        const d = calcularDistanciaKm(p.latitud, p.longitud, centroides[i].latitud, centroides[i].longitud);
        if (d < dMin) {
          dMin = d;
          idx = i;
        }
      }
      grupos[idx].push(p);
    }
    const nuevos = grupos.filter((g) => g.length > 0).map(centroide);
    const cambiaron = nuevos.length !== centroides.length || nuevos.some(
      (c, i) => Math.abs(c.latitud - centroides[i].latitud) > 1e-9 || Math.abs(c.longitud - centroides[i].longitud) > 1e-9,
    );
    centroides.splice(0, centroides.length, ...nuevos);
    if (!cambiaron) {
      break;
    }
  }
  return grupos.filter((g) => g.length > 0);
}

/**
 * Subdivide cualquier grupo que exceda maxParadas (divide en subgrupos de a lo
 * sumo maxParadas por cercanía). Recursivo y determinista.
 */
function subdividir(grupo: ParadaGeo[], maxParadas: number): ParadaGeo[][] {
  if (grupo.length <= maxParadas) {
    return [grupo];
  }
  const k = Math.ceil(grupo.length / maxParadas);
  const subgrupos = kMeans(grupo, k);
  return subgrupos.flatMap((sg) => subdividir(sg, maxParadas));
}

/**
 * Segmenta la ruta del día en trayectos de hasta `maxParadas` paradas,
 * agrupando por cercanía geográfica (K-means) y ordenando cada trayecto por
 * vecino más cercano. Devuelve un array de trayectos (cada uno es un array de
 * paradas ordenado).
 */
export function segmentarTrayectos(paradas: ParadaGeo[], maxParadas: number): Trayecto[] {
  if (paradas.length === 0 || maxParadas <= 0) {
    return [];
  }
  if (paradas.length <= maxParadas) {
    return [ordenarPorVecinoMasCercano(paradas)];
  }
  const k = Math.ceil(paradas.length / maxParadas);
  const grupos = kMeans(paradas, k);
  const gruposFinales = grupos.flatMap((g) => subdividir(g, maxParadas));
  return gruposFinales.map(ordenarPorVecinoMasCercano);
}