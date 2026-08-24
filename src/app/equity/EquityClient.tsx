"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import { SECTOR_LABEL, SECTORES, type Sector } from "@/lib/equity-sectores";
import {
  PERIODOS, PERIODO_LABEL, colorRetorno, fmtCap, fmtFecha, fmtNumero, fmtPct, fmtUsd,
} from "@/lib/equity-formato";
import type { FilaConRetornos, Periodo } from "@/lib/equity-formato";

/** Un tono por sector, para que el ojo agrupe sin leer la etiqueta. */
const SECTOR_HUE: Record<Sector, number> = {
  "Communication Services": 320,
  "Consumer Discretionary": 30,
  "Consumer Staples": 90,
  Energy: 60,
  Financials: 230,
  "Health Care": 170,
  Industrials: 250,
  "Information Technology": 200,
  Materials: 120,
  "Real Estate": 350,
  Utilities: 280,
  // Cajón de los que no encajan en ningún GICS: gris, sin color propio
  Otros: 0,
};

const sectorColor = (s: Sector, l = 65) =>
  s === "Otros" ? `oklch(${l}% 0 0)` : `oklch(${l}% 0.11 ${SECTOR_HUE[s]})`;

/** Valor del período en una fila: "dia" vive arriba, el resto en `retornos`. */
function valorPeriodo(f: FilaConRetornos, p: Periodo): number | null {
  return p === "dia" ? f.dia : f.retornos[p];
}

// ─── Filtros guardados ──────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  ayuda: string;
  /** Período que tiene sentido mirar con este filtro. */
  periodo?: Periodo;
  filtro?: (f: FilaConRetornos) => boolean;
}

const PRESETS: Preset[] = [
  {
    id: "todos",
    label: "Todo el ranking",
    ayuda: "Las de más momentum de NYSE y Nasdaq, sin filtrar",
  },
  {
    id: "maximos",
    label: "Cerca de máximos",
    ayuda: "A menos de 5% de su máximo de 52 semanas: tendencia intacta",
    filtro: (f) => (f.desdeMaximo ?? -99) > -5,
  },
  {
    id: "vuelta",
    label: "Se dieron vuelta",
    ayuda: "Vienen mal en 12 meses pero el último mes cambió: posible piso",
    periodo: "mes",
    filtro: (f) => (f.año ?? 0) < 0 && (f.retornos.mes ?? 0) > 5,
  },
  {
    id: "castigados",
    label: "Castigados con ganancias",
    ayuda: "Más de 25% abajo del máximo pero con PER positivo: ganan plata igual",
    filtro: (f) => (f.desdeMaximo ?? 0) < -25 && (f.per ?? 0) > 0,
  },
  {
    id: "acelerando",
    label: "Acelerando",
    ayuda: "El último mes le está ganando a su propio ritmo de seis meses",
    periodo: "mes",
    filtro: (f) =>
      f.retornos.mes != null && f.retornos.seis != null && f.retornos.mes > f.retornos.seis / 6,
  },
];

// ─── Componente ─────────────────────────────────────────────────────────────

export default function EquityClient({
  filas,
  indice,
}: {
  filas: FilaConRetornos[];
  /** Retorno del S&P 500 en cada período, para calcular el alpha. */
  indice: Record<Periodo, number | null>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [subiendo, setSubiendo] = useState(true);
  const [sector, setSector] = useState<Sector | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [preset, setPreset] = useState("todos");
  const [contraIndice, setContraIndice] = useState(false);
  const [agrupar, setAgrupar] = useState(false);

  /** El número que se muestra: retorno puro, o cuánto le sacó al índice. */
  const valor = useMemo(
    () => (f: FilaConRetornos, p: Periodo) => {
      const v = valorPeriodo(f, p);
      if (v == null) return null;
      if (!contraIndice) return v;
      const ref = indice[p];
      return ref == null ? null : v - ref;
    },
    [contraIndice, indice]
  );

  const activo = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => sector === "todos" || f.sector === sector)
      .filter((f) => !activo.filtro || activo.filtro(f))
      .filter(
        (f) => !q || f.ticker.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q)
      )
      .filter((f) => valor(f, periodo) != null)
      .sort((a, b) => {
        const va = valor(a, periodo)!;
        const vb = valor(b, periodo)!;
        return subiendo ? vb - va : va - vb;
      });
  }, [filas, periodo, subiendo, sector, busqueda, activo, valor]);

  /** Agrupado por sector, ordenado por el promedio del período elegido. */
  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const mapa = new Map<Sector, FilaConRetornos[]>();
    for (const f of visibles) {
      const lista = mapa.get(f.sector);
      if (lista) lista.push(f);
      else mapa.set(f.sector, [f]);
    }
    return [...mapa.entries()]
      .map(([sec, items]) => {
        const vals = items.map((f) => valor(f, periodo)!).filter((v) => v != null);
        const promedio = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        return { sector: sec, items, promedio };
      })
      .sort((a, b) => (subiendo ? b.promedio - a.promedio : a.promedio - b.promedio));
  }, [agrupar, visibles, periodo, valor, subiendo]);

  /**
   * Lo que se busca puede no estar en el ranking: son 150 papeles de 2.126.
   * Se consulta el universo completo por API —no viaja al cliente, pesa 44 KB—
   * y se ofrecen los que quedaron afuera como enlace directo a su ficha.
   */
  const [fueraDelRanking, setFueraDelRanking] = useState<
    { ticker: string; nombre: string; sector: string; argentino: boolean }[]
  >([]);

  useEffect(() => {
    const q = busqueda.trim();
    const cancelar = new AbortController();

    // Todo el estado se toca dentro del timeout: el compilador de React no
    // acepta un setState sincrónico en el cuerpo del efecto, y de paso limpiar
    // recién al vencer el retardo evita que la lista parpadee mientras se tipea
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setFueraDelRanking([]);
        return;
      }
      try {
        const r = await fetch(`/api/equity/buscar?q=${encodeURIComponent(q)}`, {
          signal: cancelar.signal,
        });
        if (!r.ok) return;
        const { resultados } = await r.json();
        setFueraDelRanking(resultados ?? []);
      } catch {
        /* búsqueda cancelada o sin red */
      }
    }, 250);

    return () => {
      clearTimeout(t);
      cancelar.abort();
    };
  }, [busqueda]);

  // Los que ya están en la tabla no hacen falta repetirlos abajo
  const enTabla = useMemo(() => new Set(visibles.map((f) => f.ticker)), [visibles]);
  const sugerencias = fueraDelRanking.filter((r) => !enTabla.has(r.ticker));

  const sectoresPresentes = useMemo(
    () => SECTORES.filter((s) => filas.some((f) => f.sector === s)),
    [filas]
  );

  const chip = (activa: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap border ${
      activa
        ? "bg-slate-800 text-slate-100 border-slate-700"
        : "text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800"
    }`;

  // ── Celdas de una fila ────────────────────────────────────────────────────
  const celdas = (f: FilaConRetornos) => (
    <>
      <td className="px-2 py-2 text-right text-[12px] text-slate-300 tabular-nums">
        {fmtUsd(f.precio)}
      </td>

      {PERIODOS.map((p) => {
        const v = valor(f, p);
        return (
          <td
            key={p}
            className={`px-2 py-2 text-right text-[12px] tabular-nums ${colorRetorno(v)} ${
              periodo === p ? "bg-slate-800/30 font-semibold" : ""
            }`}
          >
            {fmtPct(v)}
          </td>
        );
      })}

      <td className="px-2 py-2">
        <div className="flex justify-end">
          <Sparkline
            data={f.chispa}
            color={(f.retornos.seis ?? 0) >= 0 ? "oklch(72% 0.16 155)" : "oklch(68% 0.19 20)"}
          />
        </div>
      </td>

      <td className="px-2 py-2 text-right text-[11px] text-slate-400 tabular-nums">
        {fmtNumero(f.per)}
      </td>
      <td className="px-2 py-2 text-right text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
        {fmtCap(f.capitalizacion)}
      </td>
      <td className="pl-2 pr-4 py-2 text-right text-[11px] tabular-nums whitespace-nowrap">
        <span className={f.earningsEstimado ? "text-slate-600" : "text-slate-400"}>
          {fmtFecha(f.proximoEarnings)}
        </span>
        {f.proximoEarnings && f.earningsEstimado && (
          <span
            className="text-[9px] text-slate-700 ml-1"
            title="Fecha estimada por Yahoo, sin confirmar por la empresa"
          >
            est.
          </span>
        )}
      </td>
    </>
  );

  const empresa = (f: FilaConRetornos) => (
    <td className="px-2 py-2">
      <Link href={`/equity/${f.ticker}`} className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-[3px] h-7 rounded-full shrink-0"
          style={{ background: sectorColor(f.sector) }}
          title={SECTOR_LABEL[f.sector]}
        />
        <span className="min-w-0">
          <span className="text-[13px] font-medium text-slate-100 group-hover:text-white">
            {f.ticker}
          </span>
          <span className="block text-[10px] text-slate-600 truncate max-w-[190px]">
            {f.nombre}
          </span>
        </span>
      </Link>
    </td>
  );

  const COLUMNAS = 4 + PERIODOS.length + 3;

  return (
    <div className="space-y-4">
      {/* ── Períodos ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <button key={p} onClick={() => setPeriodo(p)} className={chip(periodo === p)}>
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSubiendo((v) => !v)}
          className="text-[11px] px-2.5 py-1 rounded-md border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors whitespace-nowrap"
        >
          {subiendo ? "↑ los que más subieron" : "↓ los que más bajaron"}
        </button>
      </div>

      {/* ── Filtros y vista ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              title={p.ayuda}
              onClick={() => {
                setPreset(p.id);
                if (p.periodo) setPeriodo(p.periodo);
              }}
              className={chip(preset === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setContraIndice((v) => !v)}
            title="Muestra cuánto le sacó (o le perdió) al S&P 500 en el mismo período"
            className={chip(contraIndice)}
          >
            {contraIndice ? "vs. S&P 500" : "retorno absoluto"}
          </button>
          <button onClick={() => setAgrupar((v) => !v)} className={chip(agrupar)}>
            {agrupar ? "agrupado" : "agrupar por sector"}
          </button>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="ticker o empresa…"
            className="bg-slate-900 border border-slate-800 focus:border-slate-600 outline-none rounded-md px-2.5 py-1 text-[11px] text-slate-300 w-36 placeholder:text-slate-700"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as Sector | "todos")}
            className="bg-slate-900 border border-slate-800 focus:border-slate-600 outline-none rounded-md px-2 py-1 text-[11px] text-slate-300 [color-scheme:dark]"
          >
            <option value="todos">Todos los sectores</option>
            {sectoresPresentes.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="text-left font-normal pl-4 pr-2 py-2 w-10">#</th>
                <th className="text-left font-normal px-2 py-2">Empresa</th>
                <th className="text-right font-normal px-2 py-2">Precio</th>
                {PERIODOS.map((p) => (
                  <th
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`text-right font-normal px-2 py-2 cursor-pointer transition-colors whitespace-nowrap ${
                      periodo === p ? "text-slate-200 bg-slate-800/50" : "hover:text-slate-300"
                    }`}
                  >
                    {PERIODO_LABEL[p]}
                  </th>
                ))}
                <th className="text-right font-normal px-2 py-2 whitespace-nowrap">Tendencia 6m</th>
                <th className="text-right font-normal px-2 py-2">PER</th>
                <th className="text-right font-normal px-2 py-2">Cap.</th>
                <th className="text-right font-normal pl-2 pr-4 py-2 whitespace-nowrap">Earnings</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-900">
              {grupos
                ? grupos.map((g) => (
                    <Fragment key={g.sector}>
                      <tr className="bg-slate-900/50">
                        <td colSpan={COLUMNAS} className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: sectorColor(g.sector) }}
                            />
                            <span className="text-[11px] font-medium text-slate-300">
                              {SECTOR_LABEL[g.sector]}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {g.items.length} {g.items.length === 1 ? "empresa" : "empresas"}
                            </span>
                            <span
                              className={`text-[11px] tabular-nums ml-auto ${colorRetorno(g.promedio)}`}
                            >
                              promedio {fmtPct(g.promedio)}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {g.items.map((f, i) => (
                        <tr
                          key={f.ticker}
                          className="group hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="pl-4 pr-2 py-2 text-[11px] text-slate-600 tabular-nums">
                            {i + 1}
                          </td>
                          {empresa(f)}
                          {celdas(f)}
                        </tr>
                      ))}
                    </Fragment>
                  ))
                : visibles.map((f, i) => (
                    <tr key={f.ticker} className="group hover:bg-slate-900/40 transition-colors">
                      <td className="pl-4 pr-2 py-2 text-[11px] text-slate-600 tabular-nums">
                        {i + 1}
                      </td>
                      {empresa(f)}
                      {celdas(f)}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {visibles.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-slate-600">
            Ningún papel cumple con {activo.label.toLowerCase()} y los filtros aplicados.
          </div>
        )}
      </div>

      {sugerencias.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            Fuera del ranking
          </p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((r) => (
              <Link
                key={r.ticker}
                href={`/equity/${r.ticker}`}
                className="group flex items-baseline gap-2 px-2.5 py-1.5 rounded-md border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 transition-colors"
              >
                <span className="text-[12px] font-medium text-slate-200 group-hover:text-white">
                  {r.ticker}
                </span>
                <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
                  {r.nombre}
                </span>
                {r.argentino && (
                  <span className="text-[9px] text-sky-500/80">ADR argentino</span>
                )}
              </Link>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            Estos no entraron entre las {filas.length} con más momentum, pero tienen su
            ficha completa.
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed">
        {visibles.length} de {filas.length} empresas · {activo.ayuda}.{" "}
        {contraIndice
          ? "Los porcentajes son la diferencia contra el S&P 500 en el mismo período."
          : "Los porcentajes son retornos reales sobre cierres diarios de Yahoo Finance."}{" "}
        El PER es <em>trailing</em> (últimos 12 meses).
      </p>
    </div>
  );
}
