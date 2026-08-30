"use client";

import { useState, useTransition } from "react";
import { procesarPegado } from "./actions";

/**
 * La caja de pegado: se copia el bloque de mensajes del canal y se suelta acá.
 *
 * Arranca colapsada porque el radar se usa mucho más para leer que para cargar.
 * El resultado no dice sólo cuántas noticias entraron: dice también cuántos
 * mensajes se descartaron, que es la medida de para qué sirve esto.
 *
 * Si falta la clave de la API se avisa **antes** de pegar. Enterarse recién
 * después de haber pegado cien mensajes y esperado la clasificación es la peor
 * forma de descubrir un problema de configuración.
 */
export default function CajaPegado({ sinClave = false }: { sinClave?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar() {
    if (texto.trim().length < 20) {
      setResultado("Pegá al menos un par de mensajes.");
      return;
    }
    iniciar(async () => {
      const r = await procesarPegado(texto);
      if (r.error) {
        setResultado(`No se pudo procesar: ${r.error}`);
        return;
      }
      const partes = [`${r.guardados} ${r.guardados === 1 ? "noticia" : "noticias"}`];
      if (r.duplicados > 0) partes.push(`${r.duplicados} ya estaban`);
      if (r.descartados > 0) partes.push(`${r.descartados} descartados`);
      setResultado(partes.join(" · "));
      if (r.guardados > 0 || r.duplicados > 0) setTexto("");
    });
  }

  if (!abierta) {
    return (
      <button
        onClick={() => setAbierta(true)}
        className="w-full rounded-card border border-dashed border-outline bg-card/50 px-[18px] py-3 text-left text-[12px] text-secundario hover:text-titulo hover:border-separador transition-colors"
      >
        + Pegar un volcado del canal
        <span className="text-meta-suave ml-2 text-[11px]">
          copiá los mensajes de WhatsApp y soltalos acá
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-card border border-borde bg-card overflow-hidden">
      <div className="px-[18px] py-2.5 border-b border-divisor flex items-baseline gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#cbd5e1]">
          Pegar volcado
        </span>
        <span className="text-[11px] text-meta-suave">
          se queda con lo que importa y tira el resto
        </span>
        <button
          onClick={() => setAbierta(false)}
          className="ml-auto text-[11px] text-meta hover:text-cuerpo transition-colors"
        >
          cerrar
        </button>
      </div>

      <div className="p-[18px]">
        {sinClave && (
          <p className="text-[11px] text-amber-500/85 border border-amber-900/50 rounded-chip px-3 py-2 mb-3 leading-relaxed">
            Falta <code className="text-amber-400/90">ANTHROPIC_API_KEY</code> en el entorno: sin
            ella no se puede clasificar. En local va en un <code>.env.local</code> en la raíz; en
            Vercel, en Settings → Environment Variables.
          </p>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder="[10:42] Research: El BCRA convalidó una baja de 200 pb en la tasa de política…&#10;[10:44] Mercados: Buen día equipo 👋&#10;[10:51] Flash: Licitación del Tesoro — roll over del 118%…"
          className="w-full rounded-chip border border-outline bg-boton px-3 py-2.5 text-[12.5px] text-cuerpo placeholder:text-meta-suave outline-none focus:border-separador transition-colors resize-y font-mono leading-relaxed"
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={enviar}
            disabled={pendiente}
            className="text-[12px] px-3.5 py-1.5 rounded-chip border border-outline bg-boton text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
          >
            {pendiente ? "Clasificando…" : "Clasificar"}
          </button>
          {resultado && <span className="text-[11px] text-secundario">{resultado}</span>}
        </div>
      </div>
    </div>
  );
}
