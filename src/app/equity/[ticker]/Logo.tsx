"use client";

import { useState } from "react";

/**
 * Logo de la empresa.
 *
 * Yahoo no da logos. Se usa el servicio de favicons de Google contra el dominio
 * del sitio corporativo, que es lo único gratis y estable que quedó — Clearbit,
 * que daba logos de verdad, cerró. La contra: es un favicon, así que la
 * resolución depende de lo que tenga subido cada empresa (entre 48 y 128 px).
 *
 * Si no hay dominio o la imagen falla, cae en las iniciales del ticker.
 */
export default function Logo({ web, ticker, tamaño = 40 }: {
  web: string | null;
  ticker: string;
  tamaño?: number;
}) {
  const [falló, setFalló] = useState(false);

  let dominio: string | null = null;
  if (web) {
    try {
      dominio = new URL(web).hostname.replace(/^www\./, "");
    } catch {
      dominio = null;
    }
  }

  const clases =
    "rounded-lg border border-slate-800 bg-slate-900 shrink-0 flex items-center justify-center overflow-hidden";

  if (!dominio || falló) {
    return (
      <div className={clases} style={{ width: tamaño, height: tamaño }}>
        <span className="text-[11px] font-semibold text-slate-500">{ticker.slice(0, 4)}</span>
      </div>
    );
  }

  return (
    <div className={clases} style={{ width: tamaño, height: tamaño }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- host externo, sin optimizador */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=128`}
        alt={`Logo de ${ticker}`}
        width={tamaño - 12}
        height={tamaño - 12}
        loading="lazy"
        onError={() => setFalló(true)}
        className="object-contain"
      />
    </div>
  );
}
