import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PomodoroTimer from "@/components/PomodoroTimer";
import { getDb } from "@/lib/db";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Dashboard · Facultad",
  description: "Dashboard personal de facultad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const subjects = getDb()
    .prepare("SELECT id, name, short, hue FROM subjects ORDER BY name")
    .all() as { id: number; name: string; short: string; hue: number }[];

  return (
    <html lang="es" className={`${geist.variable} dark h-full`}>
      <body className="flex h-full bg-slate-950 text-slate-100 antialiased">
        <Sidebar subjects={subjects} />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <PomodoroTimer />
      </body>
    </html>
  );
}
