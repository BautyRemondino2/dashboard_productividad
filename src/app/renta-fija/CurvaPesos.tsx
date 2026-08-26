"use client";

import CurvaNS, { type PuntoNube } from "./CurvaNS";
import type { CurvaArs } from "@/lib/bonos-ars";

/**
 * Las dos curvas en pesos ajustados: CER y dólar linked.
 *
 * Comparten componente porque comparten la cuenta —precio dividido por el
 * coeficiente del día— y lo único que cambia es qué índice ajusta y cómo se
 * llama el precio que sale de esa división. En la curva CER es "precio
 * ajustado", en unidades constantes; en la dólar linked es directamente el
 * precio en dólares.
 */

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fecha = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export default function CurvaPesos({
  curva,
  color,
  etiqueta,
  etiquetaPrecioAjustado,
}: {
  curva: CurvaArs;
  color: string;
  etiqueta: string;
  etiquetaPrecioAjustado: string;
}) {
  const puntos: PuntoNube[] = curva.puntos.map((p) => ({
    ticker: p.ticker,
    tir: p.tir,
    duration: p.duration,
    detalle: [
      { label: "cotiza", valor: `$${fmt(p.precio, p.precio > 1000 ? 0 : 2)}` },
      { label: etiquetaPrecioAjustado, valor: fmt(p.precioAjustado) },
      { label: "vence", valor: fecha(p.vencimiento) },
    ],
  }));

  return (
    <CurvaNS
      series={[{ id: "pesos", etiqueta, color, puntos }]}
      notaDerecha={`${curva.referencia.etiqueta} ${fmt(curva.referencia.valor, 4)} · ${fecha(curva.referencia.fecha)}`}
      vacio="Sin precios en este momento. Los bonos en pesos se piden en vivo a data912."
    />
  );
}
