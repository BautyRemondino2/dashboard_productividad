"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/today", label: "Hoy", icon: "◈" },
  { href: "/context/facultad", label: "Facultad", icon: "◦" },
  { href: "/context/newfolio", label: "NewFolio", icon: "◦" },
  { href: "/context/casa", label: "Casa", icon: "◦" },
  { href: "/habitos", label: "Hábitos", icon: "◈" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-52 shrink-0 border-r border-slate-800 flex flex-col py-6 px-4 gap-1">
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4 px-2">
        Dashboard
      </span>
      {NAV.map((item) => {
        const active =
          item.href === "/today"
            ? pathname === "/today" || pathname === "/"
            : pathname.startsWith(item.href);
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
            <span className={`text-base leading-none ${active ? "text-slate-300" : "text-slate-600"}`}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
