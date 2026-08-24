import { fmtFecha } from "@/lib/equity-formato";
import type { Noticia } from "@/lib/equity";

/** Feed de noticias del papel. */
export function PanelNoticias({ noticias }: { noticias: Noticia[] }) {
  if (noticias.length === 0) {
    return <p className="text-[11px] text-slate-600">Sin noticias recientes.</p>;
  }

  return (
    <div className="divide-y divide-slate-900">
      {noticias.map((n) => (
        <a
          key={n.url}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-2 first:pt-0 last:pb-0 group"
        >
          <p className="text-[12px] leading-snug text-slate-300 group-hover:text-slate-100 transition-colors">
            {n.titulo}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {n.medio}
            {n.fecha && ` · ${fmtFecha(n.fecha)}`}
          </p>
        </a>
      ))}
    </div>
  );
}
