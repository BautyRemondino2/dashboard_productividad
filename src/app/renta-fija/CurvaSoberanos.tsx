"use client";

import CurvaNS, { type PuntoNube } from "./CurvaNS";
import type { PuntoCurva, SpreadLey, Validacion } from "@/lib/bonos";

/**
 * Curva de rendimientos de los soberanos hard-dollar.
 *
 * Dos series porque la diferencia entre ley NY y ley argentina **es** el dato:
 * el spread entre las dos curvas es lo que el mercado cobra por litigar en
 * Nueva York en vez de en Buenos Aires. Cada ley lleva su propio ajuste, así
 * que ese spread se puede leer a cualquier plazo y no sólo en los años donde
 * existe el par.
 *
 * Los bonos que `validarCurva()` marca como sospechosos se dibujan apagados y
 * **no entran al ajuste**: si el flujo de uno está mal cargado, su TIR está mal,
 * y dejarla adentro torcería la curva contra la que se comparan los demás.
 */

const COLOR = {
  NY: "#3987e5",
  AR: "#d95926",
} as const;

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CurvaSoberanos({
  puntos,
  spreads,
  validacion,
  ust10y,
}: {
  puntos: PuntoCurva[];
  spreads: SpreadLey[];
  validacion: Validacion;
  /** Tasa del Tesoro de EE.UU. a 10 años: el piso libre de riesgo. */
  ust10y?: number | null;
}) {
  const sospechoso = (t: string) => validacion.sospechosos.includes(t);

  // Las dos referencias que enmarcan la curva soberana: abajo el libre de
  // riesgo (Tesoro), arriba lo que el riesgo país dice que debería rendir.
  const referencias: { y: number; etiqueta: string; color?: string }[] = [];
  if (ust10y != null && Number.isFinite(ust10y)) {
    referencias.push({ y: ust10y, etiqueta: `Tesoro EE.UU. 10a: ${fmt(ust10y, 1)}%`, color: "#64748b" });
  }
  if (validacion.implicita != null) {
    referencias.push({
      y: validacion.implicita,
      etiqueta: `Riesgo país implica ${fmt(validacion.implicita, 1)}%`,
      color: "#f59e0b",
    });
  }

  const aNube = (p: PuntoCurva): PuntoNube => ({
    ticker: p.ticker,
    tir: p.tir,
    duration: p.duration,
    nombre: p.nombre,
    atenuado: sospechoso(p.ticker),
    detalle: [
      { label: "precio", valor: `US$${fmt(p.precio)}` },
      { label: "vence", valor: String(p.vencimiento) },
    ],
  });

  const series = (["NY", "AR"] as const).map((ley) => ({
    id: ley,
    etiqueta: `Ley ${ley === "NY" ? "Nueva York" : "argentina"}`,
    color: COLOR[ley],
    puntos: puntos.filter((p) => p.ley === ley).map(aNube),
  }));

  return (
    <CurvaNS
      series={series}
      referencias={referencias}
      vacio="Sin precios cargados. Usá ↻ Actualizar para traerlos de las fuentes."
    >
      {spreads.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-tenue mb-2">Lo que cuesta la ley</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {spreads.map((s) => {
              const dudoso = sospechoso(s.ar.ticker) || sospechoso(s.ny.ticker);
              return (
                <span key={s.vencimiento} className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-secundario">{s.vencimiento}</span>
                  <span className={`text-[13px] tabular-nums ${dudoso ? "text-meta" : "text-cuerpo"}`}>
                    {s.spreadPb > 0 ? "+" : ""}
                    {Math.round(s.spreadPb)} pb
                  </span>
                  {dudoso && <span className="text-[9px] text-amber-600/80">?</span>}
                </span>
              );
            })}
          </div>
          <p className="text-[10px] text-meta mt-1.5 leading-relaxed">
            Cuánto más rinde el Bonar que el Global del mismo año. Mismos flujos y mismo deudor: la
            diferencia es dónde se litiga si hay default.
          </p>
        </div>
      )}

      {validacion.mensaje && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <p className="text-[11px] text-amber-500/90 leading-relaxed">{validacion.mensaje}</p>
        </div>
      )}
    </CurvaNS>
  );
}
