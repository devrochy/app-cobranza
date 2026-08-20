/**
 * HU-53: genera el enlace directo de WhatsApp (wa.me) a partir del teléfono del
 * cliente. Normaliza el número quitando `+`, espacios y guiones. Devuelve null
 * si el teléfono está vacío.
 */
export function generarLinkWaMe(telefono: string | null | undefined): string | null {
  if (!telefono) {
    return null;
  }
  const normalizado = telefono.replace(/[^0-9]/g, "");
  if (!normalizado) {
    return null;
  }
  return `https://wa.me/${normalizado}`;
}