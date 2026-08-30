import Link from "next/link";
import { hrefGlosario } from "@/lib/glosario-instrumentos";

/**
 * Un término de la página que abre su ficha en el glosario.
 *
 * Se marca con un subrayado punteado y no con color de link: en una página que
 * es casi toda números, un azul de más compite con el dato. La idea es que el
 * término se pueda ignorar mientras se leen los valores y esté ahí la primera
 * vez que uno se pregunta qué es un dot plot.
 */
export default function LinkGlosario({
  termino,
  children,
  className = "",
}: {
  /** El término exacto en el glosario. */
  termino: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={hrefGlosario(termino)}
      title={`${termino} — ver en el glosario`}
      className={`underline decoration-dotted decoration-from-font underline-offset-[3px] decoration-[color:var(--color-meta-suave)] hover:decoration-[color:var(--color-secundario)] hover:text-cuerpo transition-colors ${className}`}
    >
      {children ?? termino}
    </Link>
  );
}
