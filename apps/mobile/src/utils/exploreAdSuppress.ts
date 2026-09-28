/**
 * Volver del detalle de una propiedad a Explorar dispara el mismo evento de
 * foco que cambiar de pestaña hacia Explorar — para React Navigation son lo
 * mismo. Este flag deja que `property/[id]` avise "vengo de ahí" para que
 * AdPopupModal se salte el popup esa vez puntual, sin tocar el cooldown
 * normal (que sigue aplicando para el resto de los casos).
 */
let suppressNextPopup = false;

export function markPropertyDetailOpened() {
  suppressNextPopup = true;
}

/** Lee el flag y lo resetea — se consume una sola vez. */
export function consumeSuppressNextPopup(): boolean {
  const value = suppressNextPopup;
  suppressNextPopup = false;
  return value;
}
