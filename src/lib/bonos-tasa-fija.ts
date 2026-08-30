/**
 * La curva de tasa fija en pesos: Lecaps y Boncaps.
 *
 * Era el hueco más grande del panel. Es, de lejos, lo más operado del mercado
 * de pesos —lo que se le ofrece a un cliente que quiere quedarse en pesos sin
 * ajuste— y hasta ahora había que ir a buscarlo afuera.
 *
 * A diferencia de un CER o un dólar linked, acá no hay coeficiente ni rezago
 * que acertar: la letra paga una cifra fija de pesos en una fecha fija. El
 * cronograma se guarda tal cual (`bonos-flujos-tasa-fija.ts`) y el precio se
 * pide en vivo a data912, igual que el resto de las curvas.
 *
 * ── Por qué la TEM y no sólo la TIREA ───────────────────────────────────────
 *
 * En el mercado local estos instrumentos se cotizan en **tasa efectiva
 * mensual**, no anual: "la Lecap de octubre paga 2,1%". Es la forma en que el
 * cliente compara contra un plazo fijo o contra la inflación esperada del mes,
 * así que la curva muestra las dos y la TEM va primero.
 *
 * ── El breakeven, que es para qué sirve tener las dos curvas ────────────────
 *
 * Un cliente que elige entre una Lecap y un Boncer está haciendo, sin decirlo,
 * una apuesta sobre la inflación. La tasa fija le conviene si la inflación
 * resulta menor que la diferencia entre las dos curvas. Ese número —el
 * breakeven— es la pregunta que hay que poder contestar, y sale de comparar la
 * tasa nominal contra la tasa real al mismo plazo.
 */

import {
  CONV_ARS, calcularDuration, calcularTir, precioDe, type FilaData912,
} from "@/lib/bonos";
import { TASA_FIJA } from "@/lib/bonos-flujos-tasa-fija";
import { ajustarNelsonSiegel } from "@/lib/nelson-siegel";
import type { PuntoArs } from "@/lib/bonos-ars";

/** Los dos paneles donde cotizan: los bonos largos y las letras. */
const DATA912 = [
  "https://data912.com/live/arg_bonds",
  "https://data912.com/live/arg_notes",
];

/**
 * Menos de un mes al vencimiento y la tasa anualizada deja de significar algo:
 * dos décimas de precio son decenas de puntos de TIR. Mismo umbral que usan las
 * otras curvas en pesos, para que las tres se corten igual.
 */
const DURATION_MINIMA = 0.08;

export interface PuntoTasaFija {
  ticker: string;
  nombre: string;
  /** Lo que cotiza, en pesos por cada 100 VN. */
  precio: number;
  /** Tasa efectiva anual, en %. */
  tir: number;
  /** Tasa efectiva mensual, en %. Es como se cotizan en el mercado local. */
  tem: number;
  /** Duration modificada, en años. */
  duration: number;
  /** Días calendario hasta el vencimiento. */
  dias: number;
  vencimiento: string;
}

export interface CurvaTasaFija {
  puntos: PuntoTasaFija[];
  /**
   * Cuántos instrumentos del archivo ya vencieron. Las Lecaps rotan con cada
   * licitación, así que el archivo generado envejece: este número es lo que
   * deja avisar en pantalla en vez de mostrar una curva cada vez más flaca sin
   * decir por qué.
   */
  vencidas: number;
  /** Cuántos hay en el archivo, vencidos incluidos. */
  total: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function getPrecios(): Promise<Map<string, FilaData912>> {
  const respuestas = await Promise.allSettled(
    DATA912.map((u) => fetch(u, { signal: AbortSignal.timeout(8000), cache: "no-store" }).then((r) => r.json()))
  );
  const mapa = new Map<string, FilaData912>();
  for (const r of respuestas) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    for (const fila of r.value as FilaData912[]) mapa.set(fila.symbol, fila);
  }
  return mapa;
}

/** TIREA → tasa efectiva mensual, las dos en tanto por uno. */
const aMensual = (anual: number) => Math.pow(1 + anual, 1 / 12) - 1;

const diasEntre = (desde: Date, hasta: string) =>
  Math.round((new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${iso(desde)}T00:00:00Z`).getTime()) / 86_400_000);

/**
 * La curva de tasa fija de hoy. Si data912 no responde, tira: el panel lo
 * captura y avisa, que es mejor que dibujar media curva.
 */
export async function getCurvaTasaFija(hoy = new Date()): Promise<CurvaTasaFija> {
  const precios = await getPrecios();
  const hoyIso = iso(hoy);

  const puntos: PuntoTasaFija[] = [];
  let vencidas = 0;

  for (const letra of TASA_FIJA) {
    if (letra.vencimiento <= hoyIso) {
      vencidas++;
      continue;
    }
    const precio = precioDe(precios.get(letra.simboloPrecio));
    if (precio == null || precio <= 0) continue;

    const tir = calcularTir(letra.flujos, precio, hoy, CONV_ARS);
    if (tir == null) continue;

    const duration = calcularDuration(letra.flujos, tir, hoy, CONV_ARS);
    if (duration == null || duration < DURATION_MINIMA) continue;

    puntos.push({
      ticker: letra.ticker,
      nombre: letra.nombre,
      precio,
      tir: tir * 100,
      tem: aMensual(tir) * 100,
      duration,
      dias: diasEntre(hoy, letra.vencimiento),
      vencimiento: letra.vencimiento,
    });
  }

  return {
    puntos: puntos.sort((a, b) => a.duration - b.duration),
    vencidas,
    total: TASA_FIJA.length,
  };
}

// ─── Breakeven de inflación ──────────────────────────────────────────────────

export interface Breakeven {
  ticker: string;
  vencimiento: string;
  duration: number;
  /** TIREA de la tasa fija, en %. */
  tirFija: number;
  /** Tasa real que da la curva CER a ese mismo plazo, en %. */
  tirReal: number;
  /** Inflación anual implícita, en %. */
  anual: number;
  /** La misma, expresada mensual — que es como se la mira acá. */
  mensual: number;
}

/**
 * Qué inflación tiene que haber para que dé lo mismo una Lecap que un Boncer.
 *
 * La cuenta es la de Fisher: si la tasa fija paga `n` y la real paga `r`, el
 * mercado está descontando `(1+n)/(1+r) − 1` de inflación para ese plazo. Por
 * encima de ese número conviene el CER; por debajo, la tasa fija.
 *
 * La tasa real se lee del **ajuste** de la curva CER y no del Boncer más
 * cercano: los vencimientos de las dos familias no coinciden, y comparar una
 * Lecap de noviembre contra un Boncer de marzo mete en el breakeven la
 * pendiente de la curva, que no tiene nada que ver con la inflación esperada.
 *
 * Sólo se calcula dentro del rango donde la curva CER tiene bonos de verdad.
 * Fuera de ahí el ajuste extrapola, y un breakeven extrapolado se lee como un
 * dato cuando no lo es.
 */
export function breakevenInflacion(
  fija: PuntoTasaFija[],
  cer: PuntoArs[]
): Breakeven[] {
  if (fija.length === 0 || cer.length < 4) return [];

  const ajuste = ajustarNelsonSiegel(
    cer.map((p) => ({ ticker: p.ticker, duration: p.duration, tir: p.tir }))
  );
  if (!ajuste) return [];

  const out: Breakeven[] = [];
  for (const p of fija) {
    if (p.duration < ajuste.rango.min || p.duration > ajuste.rango.max) continue;

    const real = ajuste.tasa(p.duration) / 100;
    const nominal = p.tir / 100;
    const anual = (1 + nominal) / (1 + real) - 1;
    if (!Number.isFinite(anual)) continue;

    out.push({
      ticker: p.ticker,
      vencimiento: p.vencimiento,
      duration: p.duration,
      tirFija: p.tir,
      tirReal: real * 100,
      anual: anual * 100,
      mensual: aMensual(anual) * 100,
    });
  }
  return out;
}
