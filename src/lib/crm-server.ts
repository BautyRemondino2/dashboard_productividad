import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Refresca lo que muestra datos del CRM después de una mutación: la pantalla
 * propia y el home, donde vive el widget de acciones de hoy.
 */
export function revalidarCrm() {
  revalidatePath("/crm");
  revalidatePath("/mercado");
}
