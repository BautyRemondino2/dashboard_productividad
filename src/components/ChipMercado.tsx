"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { feriadosEnFecha, proximosFeriados } from "@/lib/feriados-mercado";

/**
 * El chip de la barra de navegación: qué mercado no opera hoy.
 *
 * Va al lado de la efeméride argentina y sólo aparece cuando hay algo que
 * decir. Es el aviso que faltaba: el banner de cada página explica el porqué,
 * pero para enterarse había que estar en esa página.
 *
 * También avisa la víspera. Saber el lunes a la mañana que el jueves no hay
 * rueda cambia cómo se arma la semana; enterarse el jueves, no sirve de nada.
 */

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BANDERA = { eeuu: "EE.UU.", argentina: "ARG" } as const;

export default function ChipMercado() {
  const [hoy, setHoy] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoy(hoyISO());
    const t = setInterval(() => setHoy(hoyISO()), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const aviso = useMemo(() => {
    if (!hoy) return null;

    const deHoy = feriadosEnFecha(hoy);
    if (deHoy.length > 0) {
      const f = deHoy[0];
      return {
        texto: `${BANDERA[f.mercado]} ${f.medioDia ? "media rueda" : "sin rueda"}`,
        detalle: f.nombre,
        clase: f.medioDia ? "bg-amber-400" : "bg-baja",
        fuerte: true,
      };
    }

    // Sólo se anuncia con pocos días: un feriado a tres semanas es ruido.
    const proximo = proximosFeriados(hoy, 1)[0];
    if (!proximo) return null;
    const dias = Math.round(
      (Date.parse(`${proximo.fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000
    );
    if (dias > 4) return null;

    return {
      texto: `${BANDERA[proximo.mercado]} ${dias === 1 ? "mañana" : `en ${dias} días`}`,
      detalle: proximo.nombre,
      clase: "bg-slate-500",
      fuerte: false,
    };
  }, [hoy]);

  if (!aviso) return null;

  return (
    <Link
      href="/efemerides#mercados"
      title={`${aviso.detalle} · ver el calendario de feriados de mercado`}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${aviso.clase}`} />
      <span
        className={`whitespace-nowrap ${aviso.fuerte ? "text-slate-200 font-medium" : "text-slate-300"}`}
      >
        {aviso.texto}
      </span>
      <span className="text-slate-600 hidden sm:inline">·</span>
      <span className="text-slate-500 whitespace-nowrap hidden sm:inline">{aviso.detalle}</span>
    </Link>
  );
}
