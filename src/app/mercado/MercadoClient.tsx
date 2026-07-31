"use client";

import { useMemo, useState, useTransition } from "react";
import Sparkline from "@/components/Sparkline";
import { localDateStr } from "@/lib/utils";
import {
  computePanelIndicator, defaultMetric, formatDelta, formatValor,
  INSTRUMENTO_TIPOS, LOWER_IS_BETTER, TIPO_HUE, TIPO_LABEL, UNIDADES,
} from "@/lib/mercado";
import type {
  DeltaInfo, InstrumentoTipo, Ley, MarketInstrument, MarketSeriesPoint,
  Moneda, PanelIndicator, Unidad,
} from "@/lib/mercado";
import { addMarketInstrument, saveMarketValues } from "@/app/actions";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const tipoColor = (tipo: InstrumentoTipo, l = 65) => `oklch(${l}% 0.11 ${TIPO_HUE[tipo]})`;
const tipoSoft  = (tipo: InstrumentoTipo, a = 0.4) => `oklch(28% 0.05 ${TIPO_HUE[tipo]} / ${a})`;

const CLAVES: InstrumentoTipo[] = ["fx", "tasa", "macro"];
const PESOS:  InstrumentoTipo[] = ["lecap", "cer"];
const OTROS:  InstrumentoTipo[] = ["on", "cedear"];

/** "1.234,5" o "64.30" → number (acepta coma o punto decimal). */
function parseDecimal(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  if (t.includes(",")) return parseFloat(t.replace(/\./g, "").replace(",", "."));
  return parseFloat(t);
}

function formatFechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

// ─── Delta chip ────────────────────────────────────────────────────────────────
function DeltaChip({ label, delta, unidad, lowerIsBetter }: {
  label: string; delta: DeltaInfo | null; unidad: Unidad; lowerIsBetter: boolean;
}) {
  if (!delta) {
    return (
      <span className="text-[10px] text-slate-700 whitespace-nowrap">
        {label} <span className="tabular-nums">—</span>
      </span>
    );
  }
  const flat = delta.abs === 0;
  const up = delta.abs > 0;
  const good = lowerIsBetter ? !up : up;
  const cls = flat ? "text-slate-500" : good ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`text-[10px] tabular-nums font-medium whitespace-nowrap ${cls}`}
      title={`vs. ${formatFechaCorta(delta.refFecha)}`}>
      <span className="text-slate-600 font-normal">{label}</span>{" "}
      {flat ? "=" : up ? "▲" : "▼"} {formatDelta(delta, unidad)}
    </span>
  );
}

function DeltaRow({ ind, unidad, lowerIsBetter }: {
  ind: PanelIndicator; unidad: Unidad; lowerIsBetter: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <DeltaChip label="ant" delta={ind.dPrev} unidad={unidad} lowerIsBetter={lowerIsBetter} />
      <DeltaChip label="30d" delta={ind.d30}  unidad={unidad} lowerIsBetter={lowerIsBetter} />
      <DeltaChip label="90d" delta={ind.d90}  unidad={unidad} lowerIsBetter={lowerIsBetter} />
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────
function Section({ label, count, children }: {
  label: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</h3>
        {count !== undefined && <span className="text-[10px] text-slate-700 tabular-nums">{count}</span>}
        <div className="flex-1 h-px bg-slate-900" />
      </div>
      {children}
    </div>
  );
}

// ─── IndicatorTile (claves) ────────────────────────────────────────────────────
function IndicatorTile({ inst, ind, spark }: {
  inst: MarketInstrument; ind: PanelIndicator; spark: number[];
}) {
  const lower = LOWER_IS_BETTER.has(inst.ticker);
  const trendUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : true;
  const trendGood = lower ? !trendUp : trendUp;
  return (
    <div className="relative rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: tipoColor(inst.tipo, 70) }} />
      <div className="pl-4 pr-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-[12px] font-medium text-slate-300 truncate">{inst.nombre}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
            style={{ background: tipoSoft(inst.tipo, 0.35), color: tipoColor(inst.tipo, 80) }}>
            {inst.ticker}
          </span>
        </div>
        {ind.last ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-xl font-semibold text-slate-100 tabular-nums leading-tight">
                  {formatValor(ind.last.valor, inst.unidad)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">al {formatFechaCorta(ind.last.fecha)}</div>
              </div>
              {spark.length >= 2 && (
                <Sparkline data={spark} width={72} height={24}
                  color={trendGood ? "rgb(52,211,153)" : "rgb(248,113,113)"} />
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-900">
              <DeltaRow ind={ind} unidad={inst.unidad} lowerIsBetter={lower} />
            </div>
          </>
        ) : (
          <div className="text-[12px] text-slate-600 italic py-1.5">sin datos — cargalo en el panel →</div>
        )}
      </div>
    </div>
  );
}

// ─── Tabla de instrumentos (bonos y pesos) ─────────────────────────────────────
const LEY_LABEL: Record<Ley, string> = { AR: "Ley AR", NY: "Ley NY" };
const LEY_COLOR: Record<Ley, string> = {
  AR: "oklch(65% 0.13 25)",
  NY: "oklch(65% 0.11 210)",
};

function InstrumentTable({ rows }: {
  rows: { inst: MarketInstrument; ind: PanelIndicator; spark: number[] }[];
}) {
  const grid = { gridTemplateColumns: "minmax(120px,1.4fr) 1fr 1fr 1fr 1fr 88px" };
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
      <div className="grid items-center gap-x-4 px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500"
        style={grid}>
        <div>Instrumento</div><div className="text-right">Último</div>
        <div className="text-right">vs. ant</div><div className="text-right">30d</div>
        <div className="text-right">90d</div><div />
      </div>
      <div className="divide-y divide-slate-900">
        {rows.map(({ inst, ind, spark }) => {
          const lower = LOWER_IS_BETTER.has(inst.ticker);
          const trendUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : true;
          const cell = (delta: DeltaInfo | null) => {
            if (!delta) return <span className="text-[11px] text-slate-700 tabular-nums">—</span>;
            const flat = delta.abs === 0;
            const up = delta.abs > 0;
            const good = lower ? !up : up;
            return (
              <span className={`text-[11px] tabular-nums font-medium ${
                flat ? "text-slate-500" : good ? "text-emerald-400" : "text-red-400"
              }`} title={`vs. ${formatFechaCorta(delta.refFecha)}`}>
                {flat ? "=" : up ? "▲" : "▼"} {formatDelta(delta, inst.unidad)}
              </span>
            );
          };
          return (
            <div key={inst.ticker} className="grid items-center gap-x-4 px-4 py-2.5 relative"
              style={grid}>
              <div className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: inst.ley ? LEY_COLOR[inst.ley] : tipoColor(inst.tipo, 70) }} />
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[13px] font-medium text-slate-100">{inst.ticker}</span>
                {inst.ley && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ background: `oklch(28% 0.05 ${inst.ley === "AR" ? 25 : 210} / 0.4)`, color: LEY_COLOR[inst.ley] }}>
                    {LEY_LABEL[inst.ley]}
                  </span>
                )}
              </div>
              <div className="text-right">
                {ind.last ? (
                  <div>
                    <span className="text-[13px] font-semibold text-slate-100 tabular-nums">
                      {formatValor(ind.last.valor, inst.unidad)}
                    </span>
                    <span className="text-[9px] text-slate-600 ml-1.5">{formatFechaCorta(ind.last.fecha)}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-700 italic">sin datos</span>
                )}
              </div>
              <div className="text-right">{cell(ind.dPrev)}</div>
              <div className="text-right">{cell(ind.d30)}</div>
              <div className="text-right">{cell(ind.d90)}</div>
              <div className="flex justify-end">
                {spark.length >= 2 && (
                  <Sparkline data={spark} width={72} height={20}
                    color={trendUp ? "rgb(52,211,153)" : "rgb(248,113,113)"} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carga del día ─────────────────────────────────────────────────────────────
function CargaPanel({ instruments, lastByTicker }: {
  instruments: MarketInstrument[];
  lastByTicker: Record<string, MarketSeriesPoint | null>;
}) {
  const [fecha, setFecha] = useState(localDateStr());
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filled = Object.entries(values).filter(([, v]) => v.trim() !== "");

  function save() {
    const entries: { instrumento: string; metrica: string; valor: number }[] = [];
    for (const [ticker, raw] of filled) {
      const valor = parseDecimal(raw);
      if (!Number.isFinite(valor)) {
        setMsg({ ok: false, text: `Valor inválido para ${ticker}: "${raw}"` });
        return;
      }
      const inst = instruments.find((i) => i.ticker === ticker);
      if (!inst) continue;
      entries.push({ instrumento: ticker, metrica: defaultMetric(inst.tipo), valor });
    }
    if (entries.length === 0) return;
    startTransition(async () => {
      const res = await saveMarketValues(fecha, entries);
      if (res.ok) {
        setValues({});
        setMsg({ ok: true, text: `${res.saved} ${res.saved === 1 ? "valor guardado" : "valores guardados"} · ${formatFechaCorta(fecha)}` });
      } else {
        setMsg({ ok: false, text: res.error ?? "Error al guardar" });
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-100">Carga del día</h3>
          <p className="text-[10px] text-slate-600 mt-0.5">completá los que tengas · el resto queda igual</p>
        </div>
        <input
          type="date"
          value={fecha}
          onChange={(e) => { setFecha(e.target.value); setMsg(null); }}
          className="bg-slate-900 border border-slate-700 focus:border-slate-500 outline-none rounded-md px-2 py-1 text-[11px] text-slate-300 tabular-nums [color-scheme:dark]"
        />
      </div>

      <div className="px-4 py-3 space-y-1.5 max-h-[52vh] overflow-y-auto">
        {instruments.filter((i) => i.id > 0).map((inst) => {
          const last = lastByTicker[inst.ticker];
          return (
            <div key={inst.ticker} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[12px] font-medium text-slate-300">{inst.ticker}</span>
                <span className="text-[10px] text-slate-600 ml-1.5 truncate">
                  {inst.nombre} · {defaultMetric(inst.tipo)}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={values[inst.ticker] ?? ""}
                onChange={(e) => { setValues((v) => ({ ...v, [inst.ticker]: e.target.value })); setMsg(null); }}
                placeholder={last ? `${last.valor.toLocaleString("es-AR")} (${formatFechaCorta(last.fecha)})` : "—"}
                className="w-28 shrink-0 bg-slate-900 border border-slate-800 focus:border-slate-500 outline-none rounded-md px-2 py-1 text-[12px] text-right text-slate-100 tabular-nums placeholder:text-slate-700"
              />
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        {msg ? (
          <p className={`text-[11px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
        ) : (
          <p className="text-[11px] text-slate-600 tabular-nums">{filled.length} para guardar</p>
        )}
        <button
          onClick={save}
          disabled={isPending || filled.length === 0}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── Nuevo instrumento ─────────────────────────────────────────────────────────
const UNIDAD_SUGERIDA: Record<InstrumentoTipo, Unidad> = {
  soberano_usd: "USD", lecap: "ARS", cer: "ARS", on: "USD",
  cedear: "ARS", fx: "ARS", tasa: "%", macro: "%",
};

function AddInstrument() {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<InstrumentoTipo>("lecap");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [ley, setLey] = useState<Ley | "">("");
  const [unidad, setUnidad] = useState<Unidad>("ARS");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeTipo(t: InstrumentoTipo) {
    setTipo(t);
    setUnidad(UNIDAD_SUGERIDA[t]);
    setMoneda(t === "soberano_usd" || t === "on" ? "USD" : "ARS");
    if (t !== "soberano_usd" && t !== "on") setLey("");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addMarketInstrument({
        ticker, nombre, tipo, moneda, ley: ley || null, unidad,
      });
      if (res.ok) {
        setTicker(""); setNombre(""); setOpen(false);
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  const inputCls = "w-full bg-slate-900 border border-slate-800 focus:border-slate-500 outline-none rounded-md px-2 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-700";
  const selectCls = `${inputCls} [color-scheme:dark]`;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/10 hover:bg-slate-900/40 px-4 py-2.5 text-[12px] text-slate-600 hover:text-slate-300 transition-all">
        + Nuevo instrumento <span className="text-slate-700">(Lecap, CER, ON…)</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-100">Nuevo instrumento</h3>
        <button onClick={() => setOpen(false)} className="text-[11px] text-slate-600 hover:text-slate-300 transition-colors">cancelar</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker (S31O6…)" className={`${inputCls} font-mono`} />
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre" className={inputCls} />
        <select value={tipo} onChange={(e) => changeTipo(e.target.value as InstrumentoTipo)} className={selectCls}>
          {INSTRUMENTO_TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        <select value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)} className={selectCls}>
          {UNIDADES.map((u) => <option key={u} value={u}>unidad: {u}</option>)}
        </select>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={selectCls}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <select value={ley} onChange={(e) => setLey(e.target.value as Ley | "")} className={selectCls}>
          <option value="">sin ley</option>
          <option value="AR">Ley AR</option>
          <option value="NY">Ley NY</option>
        </select>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button onClick={submit} disabled={isPending || !ticker.trim() || !nombre.trim()}
        className="w-full text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors">
        {isPending ? "Agregando…" : "Agregar"}
      </button>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function MercadoClient({ instruments, series }: {
  instruments: MarketInstrument[];
  series: Record<string, MarketSeriesPoint[]>;
}) {
  const computed = useMemo(() => {
    const map: Record<string, { ind: PanelIndicator; spark: number[] }> = {};
    for (const inst of instruments) {
      const s = series[inst.ticker] ?? [];
      map[inst.ticker] = {
        ind: computePanelIndicator(s),
        spark: s.slice(-90).map((p) => p.valor),
      };
    }
    return map;
  }, [instruments, series]);

  const byTipos = (tipos: InstrumentoTipo[]) =>
    instruments
      .filter((i) => tipos.includes(i.tipo))
      .map((inst) => ({ inst, ...computed[inst.ticker] }));

  const claves = byTipos(CLAVES);
  const soberanos = byTipos(["soberano_usd"]);
  const pesos = byTipos(PESOS);
  const otros = byTipos(OTROS);

  const lastByTicker = useMemo(() => {
    const map: Record<string, MarketSeriesPoint | null> = {};
    for (const inst of instruments) map[inst.ticker] = computed[inst.ticker].ind.last;
    return map;
  }, [instruments, computed]);

  // Orden de carga: claves primero (rutina diaria), después bonos y el resto
  const ordenCarga = [...claves, ...soberanos, ...pesos, ...otros].map((r) => r.inst);

  const sinDatos = instruments.length > 0 && instruments.every((i) => !computed[i.ticker].ind.last);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <div className="space-y-7 fade-up fade-up-2 min-w-0">
        {sinDatos && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            <p className="text-[13px] text-slate-300 font-medium">Todavía no hay datos.</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Arrancá cargando los valores de hoy en el panel de la derecha — con dos días de datos ya aparecen los deltas.
            </p>
          </div>
        )}

        {claves.length > 0 && (
          <Section label="Indicadores del día" count={claves.length}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {claves.map(({ inst, ind, spark }) => (
                <IndicatorTile key={inst.ticker} inst={inst} ind={ind} spark={spark} />
              ))}
            </div>
          </Section>
        )}

        {soberanos.length > 0 && (
          <Section label="Soberanos hard-dollar" count={soberanos.length}>
            <InstrumentTable rows={soberanos} />
          </Section>
        )}

        {pesos.length > 0 && (
          <Section label="Pesos" count={pesos.length}>
            <InstrumentTable rows={pesos} />
          </Section>
        )}

        {otros.length > 0 && (
          <Section label="ONs & CEDEARs" count={otros.length}>
            <InstrumentTable rows={otros} />
          </Section>
        )}
      </div>

      <div className="space-y-3 fade-up fade-up-3 xl:sticky xl:top-6">
        <CargaPanel instruments={ordenCarga} lastByTicker={lastByTicker} />
        <AddInstrument />
      </div>
    </div>
  );
}
