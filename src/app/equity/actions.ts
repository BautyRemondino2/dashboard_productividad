"use server";

import { revalidatePath } from "next/cache";
import { invalidarCache } from "@/lib/equity";

/** Tira el caché en memoria y vuelve a pedirle todo a Yahoo. */
export async function refrescarEquity() {
  invalidarCache();
  revalidatePath("/equity");
}
