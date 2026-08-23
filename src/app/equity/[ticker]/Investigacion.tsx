import { fmtFecha } from "@/lib/equity-formato";
import type { Investigacion } from "@/lib/equity-claude";
import type { Noticia } from "@/lib/equity";

/**
 * Lo que Claude encontró buscando en la web, con las páginas que consultó.
 *
 * Las fuentes se muestran siempre y en grande a propósito: esto es lo único
 * del dashboard que no sale de una API financiera, así que tiene que quedar
 * claro de dónde salió cada cosa y poder abrirse para verificar.
 */
export function PanelInvestigacion({ investigacion }: { investigacion: Investigacion }) {
  const { secciones, fuentes, generadoEl } = investigacion;

  return (
    <div className="space-y-5">
      {secciones.map((s) => (
        <div key={s.titulo}>
          <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
            {s.titulo}
          </h3>
          <p className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-line">
            {s.texto}
          </p>
        </div>
      ))}

      {fuentes.length > 0 && (
        <div className="pt-3 border-t border-slate-800/60">
          <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            Fuentes consultadas ({fuentes.length})
          </h3>
          <div className="space-y-1">
            {fuentes.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] text-slate-500 hover:text-sky-400 transition-colors truncate"
                title={f.url}
              >
                ↗ {f.titulo}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Redactado por Claude a partir de búsquedas web del{" "}
        {fmtFecha(generadoEl.slice(0, 10))}. Verificá en la fuente antes de repetirle
        un dato a un cliente: es investigación asistida, no un informe auditado.
      </p>
    </div>
  );
}

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
