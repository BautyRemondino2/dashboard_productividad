/**
 * Qué cobra un cliente y cuándo.
 *
 * Es de las preguntas que más le hacen a un asesor y hasta ahora no se podía
 * contestar desde el panel, aunque los cronogramas estuvieran en el repo desde
 * que se armaron las curvas: se usaban sólo para calcular TIR y se descartaba
 * el resto de la información que traen.
 *
 * Todo por cada 100 de valor nominal, que es como se piensa una tenencia.
 *
 * ── Qué es exacto y qué es estimación ───────────────────────────────────────
 *
 * Los soberanos hard-dollar, las ONs y las Lecaps pagan una cifra fija: lo que
 * dice el cronograma es lo que se cobra. Un CER o un dólar linked, no — pagan
 * su cupón multiplicado por un índice de la fecha de pago, que todavía no
 * existe. Para esos se aplica el índice de hoy y el pago queda marcado como
 * estimado, porque va a ser mayor: con inflación positiva el CER sube.
 *
 * Marcarlo importa. Un número de pesos sin esa aclaración se lee como una
 * promesa, y en un pago a seis meses la diferencia es grande.
 */

import { SOBERANOS, ONS } from "@/lib/bonos-flujos";
import { BONOS_CER, DOLAR_LINKED } from "@/lib/bonos-flujos-ars";
import { TASA_FIJA } from "@/lib/bonos-flujos-tasa-fija";
import { getReferenciasArs } from "@/lib/bonos-ars";

export type Familia = "Soberano" | "ON" | "Tasa fija" | "CER" | "Dólar linked";

export interface Pago {
  fecha: string;
  ticker: string;
  nombre: string;
  familia: Familia;
  /** Por cada 100 VN, en la moneda de `moneda`. */
  monto: number;
  moneda: "USD" | "ARS";
  /** true cuando el monto se calculó con el índice de hoy y el real será otro. */
  estimado: boolean;
  /** true si ese pago cancela el instrumento. */
  cancela: boolean;
}

export interface CalendarioPagos {
  pagos: Pago[];
  /** Los índices con que se estimaron los pagos ajustados, para poder decirlo. */
  referencias: { cer: number; fx: number; fecha: string } | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Los pagos de los próximos `dias`, de todas las familias, ordenados por fecha.
 *
 * Si el BCRA no responde, los CER y dólar linked quedan afuera en vez de
 * mostrarse en unidades de emisión, que no significan nada para nadie.
 */
export async function getCalendarioPagos(
  dias = 180,
  hoy = new Date()
): Promise<CalendarioPagos> {
  const desde = iso(hoy);
  const hasta = iso(new Date(hoy.getTime() + dias * 86_400_000));
  const enRango = (f: string) => f > desde && f <= hasta;

  const pagos: Pago[] = [];

  for (const b of SOBERANOS) {
    for (const f of b.flujos) {
      if (!enRango(f.fecha)) continue;
      pagos.push({
        fecha: f.fecha, ticker: b.ticker, nombre: `Ley ${b.ley === "NY" ? "NY" : "AR"}`,
        familia: "Soberano", monto: f.monto, moneda: "USD", estimado: false,
        cancela: f.fecha === b.vencimiento,
      });
    }
  }

  for (const o of ONS) {
    for (const f of o.flujos) {
      if (!enRango(f.fecha)) continue;
      pagos.push({
        fecha: f.fecha, ticker: o.ticker, nombre: o.nombre, familia: "ON",
        monto: f.monto, moneda: "USD", estimado: false,
        cancela: f.fecha === o.vencimiento,
      });
    }
  }

  for (const l of TASA_FIJA) {
    for (const f of l.flujos) {
      if (!enRango(f.fecha)) continue;
      pagos.push({
        fecha: f.fecha, ticker: l.ticker, nombre: l.nombre, familia: "Tasa fija",
        monto: f.monto, moneda: "ARS", estimado: false,
        cancela: f.fecha === l.vencimiento,
      });
    }
  }

  const refs = await getReferenciasArs(hoy).catch(() => null);

  if (refs) {
    for (const b of BONOS_CER) {
      const coef = refs.cer.valor / b.cerEmision;
      if (!(coef > 0)) continue;
      for (const f of b.flujos) {
        if (!enRango(f.fecha)) continue;
        pagos.push({
          fecha: f.fecha, ticker: b.ticker, nombre: b.nombre, familia: "CER",
          monto: f.monto * coef, moneda: "ARS", estimado: true,
          cancela: f.fecha === b.vencimiento,
        });
      }
    }

    for (const b of DOLAR_LINKED) {
      for (const f of b.flujos) {
        if (!enRango(f.fecha)) continue;
        pagos.push({
          fecha: f.fecha, ticker: b.ticker, nombre: b.nombre, familia: "Dólar linked",
          monto: f.monto * refs.fx.valor, moneda: "ARS", estimado: true,
          cancela: f.fecha === b.vencimiento,
        });
      }
    }
  }

  pagos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ticker.localeCompare(b.ticker));

  return {
    pagos,
    referencias: refs
      ? { cer: refs.cer.valor, fx: refs.fx.valor, fecha: refs.cer.fecha }
      : null,
  };
}
