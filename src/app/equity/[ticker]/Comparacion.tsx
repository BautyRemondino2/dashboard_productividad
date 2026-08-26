"use client";

import { useState } from "react";
import { fmtCap, fmtMetrica, fmtPct, colorRetorno } from "@/lib/equity-formato";
import type { MetricaComparada } from "@/lib/equity-formato";
import type { Comparacion, ParComparado } from "@/lib/equity";

/**
 * Fundamentals y comparables en un solo cuadro.
 *
 * Antes eran dos cards separados: uno con el valor contra la mediana, otro con
 * la lista de pares. Partidos así, el número del medio parecía una verdad
 * —"la mediana del sector es 18,2"— cuando lo que importa es **contra quiénes**
 * y **qué tan dispersos están**.
 *
 * Netflix es el caso que lo muestra: sus pares por sector son Verizon, AT&T y
 * T-Mobile, que no comparten ni el margen ni el ciclo. Con la mediana sola eso
 * no se ve; con la nube de puntos, sí. Por eso cada métrica ahora dibuja dónde
 * cae cada par, y la lectura es un ranking —"más caro que 7 de 8"— en vez de un
 * porcentaje contra el medio: el ranking no se lo lleva puesto un outlier.
 */

const VERDE = "text-sube";
const ROJO = "text-baja";
const NEUTRO = "text-secundario";

/** Percentil de una lista ya ordenada. */
function percentil(orden: number[], p: number): number {
  if (orden.length === 0) return 0;
  const i = (orden.length - 1) * p;
  const bajo = Math.floor(i);
  const alto = Math.ceil(i);
  return bajo === alto ? orden[bajo] : orden[bajo] + (orden[alto] - orden[bajo]) * (i - bajo);
}

interface Puesto {
  /** Cuántos pares quedan por debajo del valor propio. */
  debajo: number;
  total: number;
  /** Texto de la lectura, ya orientado según qué es mejor. */
  texto: string;
  clase: string;
}

/**
 * Dónde queda el papel entre sus pares.
 *
 * Se cuenta el puesto y no la distancia a la mediana: con un ROE que va de 8%
 * a 204%, "un 105% por encima de la mediana" no dice nada, y "mejor que 7 de 8"
 * sí. Es la misma razón por la que se usa mediana y no promedio.
 */
function puesto(m: MetricaComparada, pares: ParComparado[]): Puesto | null {
  if (m.valor == null) return null;
  const vs = pares.map((p) => p.valores[m.clave]).filter((v): v is number => v != null);
  if (vs.length < 3) return null;

  const debajo = vs.filter((v) => v < m.valor!).length;
  const total = vs.length;

  // La valuación va sin color: que un papel esté caro no es malo por sí solo
  if (m.sentido === "alto_caro") {
    const caros = total - debajo;
    return {
      debajo, total, clase: NEUTRO,
      texto:
        debajo === total ? `el más caro de los ${total + 1}`
        : debajo === 0 ? `el más barato de los ${total + 1}`
        : caros <= debajo ? `más caro que ${debajo} de ${total}`
        : `más barato que ${caros} de ${total}`,
    };
  }

  const mejorAlto = m.sentido === "alto_mejor";
  const mejores = mejorAlto ? debajo : total - debajo;
  const bueno = mejores > total / 2;

  return {
    debajo, total,
    clase: bueno ? VERDE : ROJO,
    texto:
      mejores === total ? `el mejor de los ${total + 1}`
      : mejores === 0 ? `el peor de los ${total + 1}`
      : `mejor que ${mejores} de ${total}`,
  };
}

/**
 * La nube de pares en una franja, con el papel marcado.
 *
 * La escala se recorta al percentil 10-90 del conjunto: sin eso, un ROE de 204%
 * aplasta a los otros ocho contra el borde izquierdo y la franja no muestra
 * nada. Lo que queda afuera se dibuja en el extremo, hueco, para que se vea que
 * hay algo más allá y no que no hay nada.
 */
function Franja({
  m,
  pares,
  ticker,
  activo,
  onActivo,
}: {
  m: MetricaComparada;
  pares: ParComparado[];
  ticker: string;
  activo: string | null;
  onActivo: (t: string | null) => void;
}) {
  const puntos = pares
    .map((p) => ({ ticker: p.ticker, v: p.valores[m.clave] }))
    .filter((p): p is { ticker: string; v: number } => p.v != null);

  if (m.valor == null || puntos.length < 3) {
    return <div className="h-[18px]" />;
  }

  const todos = [...puntos.map((p) => p.v), m.valor].sort((a, b) => a - b);
  let min = percentil(todos, 0.1);
  let max = percentil(todos, 0.9);
  // Con todos los valores casi iguales el rango se vuelve cero: se abre a mano
  if (max - min < 1e-9) { min = todos[0] - 1; max = todos[todos.length - 1] + 1; }

  const pos = (v: number) => {
    const t = (v - min) / (max - min);
    return { x: Math.min(1, Math.max(0, t)) * 100, fuera: t < 0 || t > 1 };
  };

  const propio = pos(m.valor);
  const mediana = m.mediana != null ? pos(m.mediana) : null;

  return (
    <div className="relative h-[18px] w-full" onMouseLeave={() => onActivo(null)}>
      <div className="absolute inset-x-0 top-[8px] h-px bg-borde" />

      {mediana && (
        <div
          className="absolute top-[2px] h-[13px] w-px bg-label"
          style={{ left: `${mediana.x}%` }}
          title="mediana de los pares"
        />
      )}

      {puntos.map((p) => {
        const { x, fuera } = pos(p.v);
        const esta = activo === p.ticker;
        return (
          <div
            key={p.ticker}
            onMouseEnter={() => onActivo(p.ticker)}
            title={`${p.ticker}: ${fmtMetrica(p.v, m.formato)}`}
            className="absolute top-[4px] -ml-[5px] w-[10px] h-[10px] flex items-center justify-center cursor-default"
            style={{ left: `${x}%` }}
          >
            {/* Relleno = par dentro de la escala; hueco = quedó fuera del
                recorte y se dibuja en el borde. La forma distingue al papel del
                resto, así que el color no tiene que cargar esa información. */}
            <span
              className={`w-[7px] h-[7px] rounded-full border transition-colors duration-[120ms] ${
                esta
                  ? "bg-cuerpo border-cuerpo"
                  : fuera
                    ? "bg-transparent border-meta"
                    : "bg-meta border-meta"
              }`}
            />
          </div>
        );
      })}

      {/* El papel va en rombo y no en punto: se distingue del resto sin color */}
      <div
        className="absolute top-[3px] -ml-[5px] w-[11px] h-[11px] rotate-45 border-2 border-fondo"
        style={{ left: `${propio.x}%`, background: "var(--color-num)" }}
        title={`${ticker}: ${fmtMetrica(m.valor, m.formato)}`}
      />
    </div>
  );
}

export default function PanelComparacion({
  comparacion,
  ticker,
}: {
  comparacion: Comparacion;
  ticker: string;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const { metricas, pares, criterio, grupo } = comparacion;

  const par = activo ? pares.find((p) => p.ticker === activo) : null;

  return (
    <div>
      <div className="grid grid-cols-[168px_minmax(0,1fr)_92px_84px] items-center gap-x-4 px-[18px] py-2 bg-encabezado border-b border-divisor text-[9px] uppercase tracking-[0.11em] text-tenue">
        <span>Métrica</span>
        <span>{ticker} contra sus pares</span>
        <span className="text-right">{ticker}</span>
        <span className="text-right">Mediana</span>
      </div>

      {metricas.map((m) => {
        const p = puesto(m, pares);
        return (
          <div
            key={m.clave}
            className="grid grid-cols-[168px_minmax(0,1fr)_92px_84px] items-center gap-x-4 px-[18px] py-2.5 border-b border-divisor-fino"
          >
            <div className="min-w-0">
              <p className="text-[12px] text-[#cbd5e1] truncate" title={m.ayuda}>
                {m.label}
              </p>
              {p && <p className={`text-[10px] mt-0.5 ${p.clase}`}>{p.texto}</p>}
            </div>

            <Franja
              m={m}
              pares={pares}
              ticker={ticker}
              activo={activo}
              onActivo={setActivo}
            />

            <span className="text-right text-[14px] font-medium text-titulo tabular-nums">
              {fmtMetrica(m.valor, m.formato)}
            </span>
            <span className="text-right text-[12px] text-tenue tabular-nums">
              {fmtMetrica(m.mediana, m.formato)}
            </span>
          </div>
        );
      })}

      {/* Los pares con nombre: sin esto la nube son puntos anónimos */}
      <div className="px-[18px] py-3 border-b border-divisor-fino">
        <p className="text-[9px] uppercase tracking-[0.11em] text-tenue mb-2">
          Los {pares.length} pares · pasá el mouse por un punto
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {pares.map((p) => (
            <span
              key={p.ticker}
              onMouseEnter={() => setActivo(p.ticker)}
              onMouseLeave={() => setActivo(null)}
              className={`flex items-baseline gap-2 cursor-default transition-colors duration-[120ms] ${
                activo === p.ticker ? "text-titulo" : "text-secundario"
              }`}
            >
              <span className="text-[12px] font-medium">{p.ticker}</span>
              <span className="text-[10px] text-tenue tabular-nums">{fmtCap(p.capitalizacion)}</span>
              {p.año != null && (
                <span className={`text-[10px] tabular-nums ${colorRetorno(p.año)}`}>
                  {fmtPct(p.año)}
                </span>
              )}
            </span>
          ))}
        </div>
        <p className="min-h-[16px] text-[11px] text-secundario mt-2">
          {par ? `${par.ticker} · ${par.nombre}` : ""}
        </p>
      </div>

      <p className="px-[18px] py-3 text-[11px] leading-relaxed text-meta-suave">
        {criterio === "industria"
          ? `Los ${pares.length} más grandes de ${grupo}, la industria de ${ticker}.`
          : `Los ${pares.length} más grandes de ${grupo}. ${ticker} no tiene suficientes pares en su industria, así que se abre al sector — que es más grueso y puede juntar negocios distintos.`}{" "}
        Cada clase de acción cuenta una vez: dos clases de la misma empresa
        inflarían la mediana. La valuación va sin color a propósito — que esté cara no es
        malo por sí solo, ni barata es buena señal automáticamente.
      </p>
    </div>
  );
}
