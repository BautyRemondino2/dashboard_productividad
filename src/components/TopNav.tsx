"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EfemerideWidget from "@/components/EfemerideWidget";

export default function TopNav({ ephemeral = false }: { ephemeral?: boolean }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/mercado") return pathname === "/" || pathname === "/mercado" || pathname.startsWith("/mercado/");
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="shrink-0 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-sm flex items-center px-5 gap-6 h-10">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2">
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-slate-100"
          style={{ background: "oklch(45% 0.15 255)" }}
        >
          b
        </div>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Asesor
        </span>
      </div>

      <NavLink href="/mercado"    label="Mercado"     active={isActive("/mercado")} />
      <NavLink href="/glossary"   label="Glosario"    active={isActive("/glossary")} />
      <NavLink href="/efemerides" label="Efemérides"  active={isActive("/efemerides")} />

      {/* Right side: Argentine ephemeris widget */}
      <div className="ml-auto flex items-center gap-3">
        {ephemeral && (
          <span
            title="El deploy corre sobre una copia temporal de la base: lo que cargues acá se pierde en el próximo arranque en frío. Para datos permanentes, usá el dashboard local."
            className="text-[10px] px-1.5 py-0.5 rounded border border-amber-900/60 text-amber-500/90 whitespace-nowrap"
          >
            datos temporales
          </span>
        )}
        <EfemerideWidget />
      </div>
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-xs font-medium transition-colors ${
        active ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </Link>
  );
}
