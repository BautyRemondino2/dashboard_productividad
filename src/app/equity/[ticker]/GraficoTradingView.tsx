"use client";

import { useEffect, useRef } from "react";

/**
 * Gráfico de TradingView (widget "advanced chart").
 *
 * Es un embed de un tercero: TradingView inyecta un iframe propio y baja el
 * script de su CDN. Si no hay internet o el script está bloqueado, queda el
 * mensaje de abajo en vez del gráfico — por eso el contenedor tiene altura fija
 * y no colapsa el layout.
 */
export default function GraficoTradingView({ ticker, alto = 460 }: {
  ticker: string;
  alto?: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    // React no re-monta el div al cambiar de ticker: hay que limpiar a mano
    nodo.innerHTML = "";

    const montaje = document.createElement("div");
    montaje.className = "tradingview-widget-container__widget";
    nodo.appendChild(montaje);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: ticker,
      interval: "D",
      range: "12M",
      timezone: "America/Argentina/Buenos_Aires",
      theme: "dark",
      style: "1", // velas
      locale: "es",
      backgroundColor: "rgba(2, 6, 23, 1)", // slate-950, el fondo del dashboard
      gridColor: "rgba(30, 41, 59, 0.5)", // slate-800
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true,
      width: "100%",
      height: alto,
      support_host: "https://www.tradingview.com",
    });
    nodo.appendChild(script);

    return () => {
      nodo.innerHTML = "";
    };
  }, [ticker, alto]);

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
      <div
        ref={contenedor}
        className="tradingview-widget-container [&_iframe]:!block"
        style={{ height: alto }}
      >
        <div className="h-full flex items-center justify-center text-[11px] text-slate-700">
          cargando el gráfico de TradingView…
        </div>
      </div>
    </div>
  );
}
