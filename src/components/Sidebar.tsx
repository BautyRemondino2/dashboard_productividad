"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  subjects: { id: number; name: string }[];
}

// Shorten long subject names for the sidebar
function shortName(name: string): string {
  const map: Record<string, string> = {
    "Capital Markets":                "Capital Markets",
    "International Finance":          "Int'l Finance",
    "Financial Engineering":          "Fin. Engineering",
    "Applied Programming in Finance": "Appl. Programming",
    "Econometrics":                   "Econometrics",
    "Computational Finance":          "Comp. Finance",
  };
  return map[name] ?? (name.length > 22 ? name.slice(0, 20) + "…" : name);
}

export default function Sidebar({ subjects }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/today") return pathname === "/today" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="w-52 shrink-0 border-r border-slate-800 flex flex-col py-6 px-3 gap-6">

      {/* Brand */}
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-2">
        Facultad
      </span>

      {/* Main navigation */}
      <div className="space-y-0.5">
        <NavLink href="/today"    label="Hoy"           icon="◈" active={isActive("/today")} />
        <NavLink href="/examenes" label="Exámenes"      icon="◫" active={isActive("/examenes")} />
        <NavLink href="/stats"    label="Estadísticas"  icon="▣" active={isActive("/stats")} />
      </div>

      {/* Subjects */}
      <div>
        <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest px-2 mb-1 block">
          Materias
        </span>
        <div className="space-y-0.5">
          {subjects.map(s => (
            <NavLink
              key={s.id}
              href={`/facultad/${s.id}`}
              label={shortName(s.name)}
              icon="◦"
              active={isActive(`/facultad/${s.id}`)}
              title={s.name}
            />
          ))}
        </div>
      </div>

    </nav>
  );
}

function NavLink({
  href, label, icon, active, title,
}: {
  href: string; label: string; icon: string; active: boolean; title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-slate-800 text-slate-100"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
      }`}
    >
      <span className={`text-sm leading-none shrink-0 ${active ? "text-slate-300" : "text-slate-600"}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
