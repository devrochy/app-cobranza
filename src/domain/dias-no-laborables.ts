import { DiasNoLaborables } from "../modules/rutas/ruta-config.entity";

/**
 * Ajusta una fecha de vencimiento de cuota al siguiente día hábil cuando cae en
 * un día no laborable según la configuración de la ruta (HU-10/HU-13).
 * - solo_domingos: solo se desplaza el domingo.
 * - domingos_y_feriados: en el MVP se comporta igual que solo_domingos (aún no
 *   existe una fuente de feriados por país; se documenta como limitación).
 *
 * Trabaja en UTC para ser consistente con la generación de cuotas
 * (formatDate/addDays en PrestamoService). Al atrasar se recorre hacia adelante
 * hasta encontrar un día hábil.
 */
export function ajustarDiaHabil(fecha: Date, diasNoLaborables: DiasNoLaborables): Date {
  const result = new Date(fecha.getTime());

  if (diasNoLaborables === "solo_domingos" || diasNoLaborables === "domingos_y_feriados") {
    // El domingo se representa con getUTCDay() === 0.
    while (result.getUTCDay() === 0) {
      result.setUTCDate(result.getUTCDate() + 1);
    }
  }

  return result;
}
