"use client";

import CurvaNS, { type PuntoNube } from "./CurvaNS";
import type { CurvaTasaFija as Datos } from "@/lib/bonos-tasa-fija";
import type { Breakeven } from "@/lib/bonos-tasa-fija";

/**
 * La curva de tasa fija en pesos: Lecaps y Boncaps.
 *
 * El gráfico va en TIREA porque es la unidad en que se comparan curvas —y la
 * que usan las otras tres de la página—, pero debajo la lista va en **tasa
 * efectiva mensual**, que es como se cotizan de verdad y como se le explica a
 * un cliente: "la de octubre paga 2,1% por mes".
 *
 * El breakeven cierra la idea. Elegir entre una Lecap y un Boncer es una
 * apuesta sobre la inflación aunque no se diga; el número dice a partir de qué
 * inflación conviene cada una.
 */

const COLOR = "#e0912f";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fecha = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export default function CurvaTasaFija({
  datos,
  breakevens,
}: {
  datos: Datos;
  breakevens: Breakeven[];
}) {
  const puntos: PuntoNube[] = datos.puntos.map((p) => ({
    ticker: p.ticker,
    nombre: p.nombre,
    tir: p.tir,
    duration: p.duration,
    detalle: [
      { label: "cotiza", valor: `$${fmt(p.precio, p.precio > 1000 ? 0 : 2)}` },
      { label: "TEM", valor: `${fmt(p.tem)}%` },
      { label: "vence", valor: `${fecha(p.vencimiento)} · ${p.dias} d` },
    ],
  }));

  return (
    <CurvaNS
      series={[{ id: "tasafija", etiqueta: "Lecaps y Boncaps", color: COLOR, puntos }]}
      vacio="Sin precios en este momento. Las letras se piden en vivo a data912."
    >
      {datos.puntos.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-tenue mb-2">
            Tasa efectiva mensual
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {datos.puntos.map((p) => (
              <span key={p.ticker} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-secundario">{p.ticker}</span>
                <span className="text-[13px] tabular-nums text-cuerpo">{fmt(p.tem)}%</span>
                <span className="text-[9.5px] text-meta-suave tabular-nums">{p.dias}d</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-meta mt-1.5 leading-relaxed">
            Lo que paga cada letra por mes, que es como se cotizan. El gráfico va en tasa anual
            para poder compararlo contra las otras curvas.
          </p>
        </div>
      )}

      {breakevens.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-tenue mb-2">
            Inflación implícita contra la curva CER
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {breakevens.map((b) => (
              <span key={b.ticker} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-secundario">{b.ticker}</span>
                <span className="text-[13px] tabular-nums text-cuerpo">{fmt(b.mensual)}%</span>
                <span className="text-[9.5px] text-meta-suave">mensual</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-meta mt-1.5 leading-relaxed">
            La inflación que iguala una Lecap con un Boncer al mismo plazo. Si la inflación termina
            por encima, convenía el CER; por debajo, la tasa fija. La tasa real sale del ajuste de
            la curva CER y no del Boncer más cercano: los vencimientos de las dos familias no
            coinciden y eso metería la pendiente de la curva adentro del número.
          </p>
        </div>
      )}

      {datos.vencidas > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <p className="text-[11px] text-amber-500/90 leading-relaxed">
            {datos.vencidas} de {datos.total} instrumentos del cronograma ya vencieron. Las letras
            rotan con cada licitación: correr{" "}
            <code className="text-amber-400/90">node scripts/generar-flujos-tasa-fija.mjs</code>{" "}
            para traer las nuevas.
          </p>
        </div>
      )}
    </CurvaNS>
  );
}
