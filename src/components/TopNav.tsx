"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EfemerideWidget from "@/components/EfemerideWidget";

/**
 * Barra de navegación, 48px y fija arriba de todo.
 *
 * El orden de las secciones sigue la frecuencia con que se usan, no el orden en
 * que se fueron construyendo: primero las cuatro de mercado, después un
 * separador, y del otro lado las dos de consulta —glosario y efemérides— que se
 * abren de vez en cuando. El separador es el que hace legible esa diferencia.
 */

const PRIMARIAS = [
  { href: "/mercado", label: "Macro" },
  { href: "/renta-fija", label: "Renta fija" },
  { href: "/equity", label: "Equity" },
  { href: "/etf", label: "ETF" },
  { href: "/eeuu", label: "EE.UU." },
];

const SECUNDARIAS = [
  { href: "/radar", label: "Radar" },
  { href: "/glossary", label: "Glosario" },
  { href: "/efemerides", label: "Efemérides" },
];

function horaDe(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TopNav({
  ephemeral = false,
  actualizado = null,
  radarPendientes = 0,
}: {
  ephemeral?: boolean;
  /** ISO del último dato automático. Se muestra como sello a la derecha. */
  actualizado?: string | null;
  /** Noticias del radar sin leer con relevancia 3+, para el punto del nav. */
  radarPendientes?: number;
}) {
  const pathname = usePathname();

  function activo(href: string) {
    // La raíz muestra el panel macro, así que cuenta como /mercado
    if (href === "/mercado") {
      return pathname === "/" || pathname === "/mercado" || pathname.startsWith("/mercado/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    // En pantalla angosta no entran las seis secciones: se desplaza en
    // horizontal en vez de recortar las últimas
    <nav className="sticky top-0 z-20 shrink-0 h-12 flex items-center gap-[2px] px-6 border-b border-borde-nav sup-nav overflow-x-auto">
      <div className="flex items-center gap-[9px] mr-7 shrink-0">
        <div
          className="w-[22px] h-[22px] rounded-badge flex items-center justify-center text-[11px] font-bold text-titulo"
          style={{ background: "var(--color-marca)" }}
        >
          b
        </div>
        <span className="text-[11px] font-semibold text-meta uppercase tracking-[0.14em]">
          Asesor
        </span>
      </div>

      {PRIMARIAS.map((s) => (
        <ItemNav key={s.href} href={s.href} label={s.label} activo={activo(s.href)} />
      ))}

      <span className="w-px h-4 bg-separador mx-[10px] shrink-0" />

      {SECUNDARIAS.map((s) => (
        <ItemNav
          key={s.href}
          href={s.href}
          label={s.label}
          activo={activo(s.href)}
          secundaria
          contador={s.href === "/radar" ? radarPendientes : 0}
        />
      ))}

      <div className="ml-auto flex items-center gap-3.5 shrink-0">
        {ephemeral && (
          <span
            title="El deploy corre sobre una copia temporal de la base: lo que cargues acá se pierde en el próximo arranque en frío. Para datos permanentes, usá el dashboard local."
            className="text-[10px] px-1.5 py-0.5 rounded-badge border border-amber-900/60 text-amber-500/90 whitespace-nowrap"
          >
            datos temporales
          </span>
        )}
        <EfemerideWidget />
        {actualizado && (
          <span className="text-[11px] text-meta-suave tabular-nums whitespace-nowrap">
            actualizado {horaDe(actualizado)}
          </span>
        )}
      </div>
    </nav>
  );
}

function ItemNav({
  href,
  label,
  activo,
  secundaria = false,
  contador = 0,
}: {
  href: string;
  label: string;
  activo: boolean;
  secundaria?: boolean;
  /** Si es mayor que cero se dibuja al lado del label. */
  contador?: number;
}) {
  return (
    <Link
      href={href}
      className={`text-[13px] shrink-0 whitespace-nowrap px-[11px] py-1.5 rounded-chip transition-colors duration-[120ms] ${
        activo
          ? "font-medium text-titulo bg-chip"
          : secundaria
            ? "text-tenue hover:bg-divisor-fino hover:text-[#cbd5e1]"
            : "font-medium text-label hover:bg-divisor-fino hover:text-[#cbd5e1]"
      }`}
    >
      {label}
      {contador > 0 && (
        <span
          title={`${contador} sin leer con relevancia 3 o más`}
          className="ml-1.5 text-[10px] font-medium tabular-nums px-1 py-px rounded-badge bg-[color:var(--color-marca)] text-titulo"
        >
          {contador}
        </span>
      )}
    </Link>
  );
}
