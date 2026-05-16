"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { subjectColor } from "@/lib/subjectColors";

interface SidebarSubject {
  id: number;
  name: string;
  short: string;
  hue: number;
}

interface Props {
  subjects: SidebarSubject[];
}

const NAV = [
  { href: "/",         label: "Hoy",       icon: "◆" },
  { href: "/glossary", label: "Glosario",  icon: "◉" },
] as const;

export default function Sidebar({ subjects }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/today";
    return pathname.startsWith(href);
  };

  return (
    <nav className="w-52 shrink-0 border-r border-slate-800/80 flex flex-col py-6 px-3 gap-6 bg-slate-950/40 h-full">
      {/* Logo */}
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

      {/* Main nav */}
      <div className="space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors ${
                active
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <span
                className={`text-sm leading-none shrink-0 ${active ? "text-slate-200" : "text-slate-600"}`}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Subjects */}
      <div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1 block">
          Materias
        </span>
        <div className="space-y-0.5">
          {subjects.map((s) => {
            const active = pathname.startsWith(`/facultad/${s.id}`);
            return (
              <Link
                key={s.id}
                href={`/facultad/${s.id}`}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors ${
                  active
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: subjectColor(s.hue, 70) }}
                />
                <span className="truncate flex-1 text-[13px]">{s.short}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pomodoro mini */}
      <div className="mt-auto px-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">
            Pomodoro
          </p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-light tabular text-slate-200">25:00</span>
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
