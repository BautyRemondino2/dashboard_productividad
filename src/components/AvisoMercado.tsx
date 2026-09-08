"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MERCADO_LABEL, esFinDeSemana, feriadosEnFecha, type Mercado,
} from "@/lib/feriados-mercado";

/**
 * El aviso de que la rueda no abrió.
 *
 * Un papel "sin variación" y un papel que no cotizó se ven exactamente igual en
 * pantalla, y el segundo no es un dato: es la ausencia de uno. El lunes de
 * Labor Day el panel de EE.UU. mostraba los números del viernes sin una línea
 * que lo explicara.
 *
 * Va arriba de la página y no en un tooltip a propósito: es la primera cosa
 * que hay que saber antes de leer cualquier número de abajo.
 *
 * La fecha se resuelve en el cliente —igual que en `EfemerideWidget`— porque el
 * server de Vercel corre en UTC y a la noche de Argentina daría el día
 * siguiente, avisando de un feriado que todavía no es.
 */

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default function AvisoMercado({ mercados }: { mercados: Mercado[] }) {
  const [hoy, setHoy] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoy(hoyISO());
    const t = setInterval(() => setHoy(hoyISO()), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!hoy) return null;

  const feriados = feriadosEnFecha(hoy).filter((f) => mercados.includes(f.mercado));
  const finde = esFinDeSemana(hoy);

  if (feriados.length === 0 && !finde) return null;

  // El fin de semana es la causa más común de que un precio no se mueva y no
  // necesita explicación: una línea gris alcanza. Un feriado sí la necesita.
  if (feriados.length === 0) {
    return (
      <p className="text-[11px] text-meta-suave mb-4">
        Es {DIAS[new Date(`${hoy}T12:00:00Z`).getUTCDay()]}: la rueda no abre. Los precios son los
        del último cierre.
      </p>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {feriados.map((f) => (
        <div
          key={`${f.mercado}-${f.nombre}`}
          className={`rounded-card border px-4 py-3 ${
            f.medioDia
              ? "border-amber-900/50 bg-amber-950/20"
              : "border-borde bg-encabezado/60"
          }`}
        >
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 self-center ${
                f.medioDia ? "bg-amber-400" : "bg-baja"
              }`}
            />
            <span className="text-[13px] font-medium text-titulo">
              {f.medioDia
                ? `${MERCADO_LABEL[f.mercado]} cierra temprano`
                : `${MERCADO_LABEL[f.mercado]} está cerrado`}
            </span>
            <span className="text-[12px] text-secundario">— {f.nombre}</span>
            <Link
              href="/efemerides#mercados"
              className="ml-auto text-[11px] text-tenue hover:text-secundario transition-colors whitespace-nowrap"
            >
              ver el calendario →
            </Link>
          </div>
          <p className="text-[11.5px] text-secundario leading-relaxed mt-1.5 max-w-[92ch]">
            {f.porQue}
          </p>
          <p className="text-[11.5px] text-meta leading-relaxed mt-1 max-w-[92ch]">
            {f.consecuencia}
          </p>
        </div>
      ))}
    </div>
  );
}
