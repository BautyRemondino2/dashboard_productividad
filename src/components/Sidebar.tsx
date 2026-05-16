"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { subjectColor } from "@/lib/subjectColors";

interface Props {
  subjects: { id: number; name: string; short: string; hue: number }[];
}

export default function Sidebar({ subjects }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/today") return pathname === "/today" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="w-52 shrink-0 border-r border-slate-800/80 flex flex-col py-6 px-3 gap-6 bg-slate-950/40">

      {/* Brand */}
      <div className="px-2 flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: "oklch(35% 0.04 250)" }}
        >
          <span className="text-[11px] font-bold text-slate-100">f</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Facultad
        </span>
      </div>

      {/* Main navigation */}
      <div className="space-y-0.5">
        <NavLink href="/today"    label="Hoy"      icon="◈" active={isActive("/today")} />
        <NavLink href="/glossary" label="Glosario" icon="◉" active={isActive("/glossary")} />
      </div>

      {/* Subjects */}
      <div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1 block">
          Materias
        </span>
        <div className="space-y-0.5">
          {subjects.map(s => (
            <Link
              key={s.id}
              href={`/facultad/${s.id}`}
              title={s.name}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors ${
                isActive(`/facultad/${s.id}`)
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: subjectColor(s.hue, 70) }}
              />
              <span className="truncate flex-1">{s.short || s.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Pomodoro mini widget */}
      <div className="mt-auto px-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">Pomodoro</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-light tabular-nums text-slate-200">25:00</span>
            <button
              className="w-7 h-7 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-center text-[10px]"
              aria-label="Iniciar pomodoro"
            >
              ▶
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">listo para empezar</p>
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
