import { creditosDe, textoFuentes, type Credito } from "@/lib/fuentes-credito";

/**
 * La nota al pie de un gráfico: de dónde salió el número.
 *
 * Va en todos los gráficos del dashboard, no en algunos. Un panel de precios
 * sin la fuente obliga a confiar de memoria, y cuando dos series del mismo
 * indicador no coinciden —el riesgo país intradiario contra el cierre— sin
 * decir cuál se está mirando la diferencia parece un error.
 *
 * Las notas de cada fuente se muestran completas: son justamente la letra
 * chica que cambia cómo se lee el número ("mediana de las TNA que publican los
 * bancos" no es lo mismo que "la TNA").
 */
export default function Fuente({
  tickers,
  creditos,
  extra,
  className = "",
}: {
  /** Los tickers de las series del gráfico. Se deduplica por fuente. */
  tickers?: string[];
  /** O los créditos ya resueltos, cuando no salen de un ticker. */
  creditos?: Credito[];
  /** Algo más que aclarar sobre este gráfico en particular. */
  extra?: string;
  className?: string;
}) {
  const lista = creditos ?? creditosDe(tickers ?? []);
  if (lista.length === 0 && !extra) return null;

  const conUrl = lista.filter((c) => c.url);
  const notas = lista.map((c) => c.nota).filter((n): n is string => !!n);

  return (
    <p className={`text-[10.5px] text-meta-suave leading-relaxed ${className}`}>
      <span className="text-tenue">Fuente: </span>
      {lista.length > 0 ? textoFuentes(lista) : "carga manual"}
      {conUrl.length > 0 && (
        <>
          {" · "}
          {conUrl.map((c, i) => (
            <span key={c.fuente}>
              {i > 0 && " · "}
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-700 underline-offset-2 hover:text-secundario transition-colors"
              >
                verificar
                {conUrl.length > 1 && ` en ${c.fuente}`}
              </a>
            </span>
          ))}
        </>
      )}
      {notas.map((n) => (
        <span key={n}>
          {" "}
          {n}
        </span>
      ))}
      {extra && ` ${extra}`}
    </p>
  );
}
