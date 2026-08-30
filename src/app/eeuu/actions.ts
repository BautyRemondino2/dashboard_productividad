"use server";

import { revalidatePath } from "next/cache";
import { invalidarFred } from "@/lib/fred";

/**
 * Tira el caché en memoria y vuelve a pedir todo.
 *
 * Los datos se refrescan solos cada media hora, así que esto es para el caso
 * puntual: acaba de salir un dato o una decisión de tasa y no se quiere esperar.
 */
export async function refrescarEeuu() {
  invalidarFred();
  revalidatePath("/eeuu");
}
