import type { ReactNode } from "react";

/**
 * El card del sistema. Todas las secciones de todas las páginas usan este.
 *
 * El subtítulo del header no es decoración: cada card declara de dónde sale el
 * dato y contra qué se compara —"TIR contra duration", "contra la mediana de
 * sus pares", "último año cerrado"—. Un número sin esa línea obliga a
 * adivinar, y adivinar mal en un panel de precios sale caro.
 *
 * El punto de acento agrupa por tema: verde para dólar, rojo para riesgo. Va
 * sólo donde hay más de un card compitiendo por la mirada.
 */
export default function Card({
  titulo,
  nota,
  acento,
  derecha,
  cuerpo = true,
  destacada = false,
  className = "",
  id,
  children,
}: {
  titulo?: string;
  /** De dónde viene el dato y contra qué se compara. */
  nota?: string;
  /** Color del punto de la izquierda, si la sección lo lleva. */
  acento?: string;
  /** Fecha del dato o badge de fuente, alineado a la derecha del header. */
  derecha?: ReactNode;
  /** false cuando el contenido trae su propio padding (tablas, listas). */
  cuerpo?: boolean;
  /** Fondo con gradiente, para el card principal de una página. */
  destacada?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-card border border-borde overflow-hidden ${
        destacada ? "sup-destacada" : "bg-card"
      } ${className}`}
    >
      {titulo && (
        <header className="px-[18px] py-3 border-b border-divisor flex items-baseline gap-2.5 flex-wrap">
          {acento && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 self-center"
              style={{ background: acento }}
            />
          )}
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#cbd5e1]">
            {titulo}
          </h2>
          {nota && <span className="text-[11px] text-meta-suave">{nota}</span>}
          {derecha && <div className="ml-auto text-[11px] text-meta-suave">{derecha}</div>}
        </header>
      )}
      {cuerpo ? <div className="p-[18px]">{children}</div> : children}
    </section>
  );
}

/** El encabezado de página: título, bajada y, opcionalmente, algo a la derecha. */
export function EncabezadoPagina({
  titulo,
  bajada,
  derecha,
}: {
  titulo: string;
  bajada?: string;
  derecha?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap mb-5">
      <div>
        <h1 className="text-[26px] font-semibold text-titulo tracking-[-0.02em]">{titulo}</h1>
        {bajada && <p className="text-[13px] text-meta mt-[5px]">{bajada}</p>}
      </div>
      {derecha}
    </div>
  );
}

/** El ancho de contenido del sistema, centrado. */
export function Contenedor({
  ancho = 1440,
  children,
}: {
  ancho?: number;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto px-6 pt-[26px]" style={{ maxWidth: `${ancho}px` }}>
      {children}
    </div>
  );
}
