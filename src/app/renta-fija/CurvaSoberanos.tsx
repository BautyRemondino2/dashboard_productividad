"use client";

import CurvaNS, { type PuntoNube } from "./CurvaNS";
import type { PuntoCurva, SpreadLey, Validacion } from "@/lib/bonos";
import type { PuntoTesoro } from "@/lib/eeuu";

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
  UST: "#64748b",
} as const;

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CurvaSoberanos({
  puntos,
  spreads,
  validacion,
  ust10y,
  tesoro,
  spreadsTesoro,
}: {
  puntos: PuntoCurva[];
  spreads: SpreadLey[];
  validacion: Validacion;
  /** Tasa del Tesoro de EE.UU. a 10 años: el respaldo si no llega la curva. */
  ust10y?: number | null;
  /** La curva del Tesoro completa, ya expresada en duration. */
  tesoro?: PuntoTesoro[];
  /** Spread de cada bono contra el Tesoro a su misma duration, en pb. */
  spreadsTesoro?: Record<string, number>;
}) {
  const sospechoso = (t: string) => validacion.sospechosos.includes(t);
  const conCurvaTesoro = (tesoro?.length ?? 0) >= 2;

  // Las referencias que enmarcan la curva soberana. El piso libre de riesgo se
  // dibuja como curva cuando está disponible —una línea plana en el 10 años
  // sobrestima el spread de los bonos cortos, que se comparan contra un tramo
  // de la curva bastante más bajo— y cae a la línea horizontal si FRED no
  // respondió.
  const referencias: { y: number; etiqueta: string; color?: string }[] = [];
  if (!conCurvaTesoro && ust10y != null && Number.isFinite(ust10y)) {
    referencias.push({ y: ust10y, etiqueta: `Tesoro EE.UU. 10a: ${fmt(ust10y, 1)}%`, color: COLOR.UST });
  }
  if (validacion.implicita != null) {
    referencias.push({
      y: validacion.implicita,
      etiqueta: `Riesgo país implica ${fmt(validacion.implicita, 1)}%`,
      color: "#f59e0b",
    });
  }

  const aNube = (p: PuntoCurva): PuntoNube => {
    const spread = spreadsTesoro?.[p.ticker];
    return {
      ticker: p.ticker,
      tir: p.tir,
      duration: p.duration,
      nombre: p.nombre,
      atenuado: sospechoso(p.ticker),
      detalle: [
        { label: "precio", valor: `US$${fmt(p.precio)}` },
        { label: "vence", valor: String(p.vencimiento) },
        ...(spread != null
          ? [{ label: "sobre Tesoro", valor: `+${Math.round(spread)} pb` }]
          : []),
      ],
    };
  };

  const series = [
    ...(["NY", "AR"] as const).map((ley) => ({
      id: ley,
      etiqueta: `Ley ${ley === "NY" ? "Nueva York" : "argentina"}`,
      color: COLOR[ley],
      puntos: puntos.filter((p) => p.ley === ley).map(aNube),
    })),
    // El Tesoro va como serie de sólo línea: mismo eje de duration, mismo
    // ajuste, y la distancia vertical contra las otras dos *es* el spread.
    ...(conCurvaTesoro
      ? [
          {
            id: "UST",
            etiqueta: "Tesoro EE.UU.",
            color: COLOR.UST,
            soloLinea: true,
            puntos: tesoro!.map((t) => ({
              ticker: t.label,
              tir: t.tir,
              duration: t.duration,
            })),
          },
        ]
      : []),
  ];

  // Los bonos con spread calculable, en orden de plazo: es el riesgo país
  // desagregado. El EMBI es un promedio de todo esto.
  const porBono = puntos
    .filter((p) => spreadsTesoro?.[p.ticker] != null)
    .sort((a, b) => a.duration - b.duration);

  return (
    <CurvaNS
      series={series}
      referencias={referencias}
      vacio="Sin precios cargados. Usá ↻ Actualizar para traerlos de las fuentes."
    >
      {porBono.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-tenue mb-2">
            Spread sobre el Tesoro
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {porBono.map((p) => (
              <span key={p.ticker} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-secundario">{p.ticker}</span>
                <span
                  className={`text-[13px] tabular-nums ${
                    sospechoso(p.ticker) ? "text-meta" : "text-cuerpo"
                  }`}
                >
                  +{Math.round(spreadsTesoro![p.ticker])} pb
                </span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-meta mt-1.5 leading-relaxed">
            Cuánto más rinde cada bono que el Tesoro de EE.UU. a su misma duration. Es el riesgo
            país desagregado: el EMBI que se publica es un promedio de estos números.
          </p>
        </div>
      )}

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
