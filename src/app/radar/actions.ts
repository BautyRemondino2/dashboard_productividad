"use server";

import { revalidatePath } from "next/cache";
import { borrarItem, ingerirTexto, marcarLeido, type ResultadoIngesta } from "@/lib/radar";

export async function procesarPegado(texto: string): Promise<ResultadoIngesta & { error?: string }> {
  try {
    const r = await ingerirTexto(texto, "pegado");
    revalidatePath("/radar");
    return r;
  } catch (e) {
    return {
      guardados: 0,
      duplicados: 0,
      descartados: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function alternarLeido(id: number, leido: boolean) {
  marcarLeido(id, leido);
  revalidatePath("/radar");
}

export async function eliminarItem(id: number) {
  borrarItem(id);
  revalidatePath("/radar");
}
