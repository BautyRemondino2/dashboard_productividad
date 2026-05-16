import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getDb } from "@/lib/db";
import type { Subject } from "@/lib/types";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Dashboard · Facultad",
  description: "Personal academic dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const subjects = getDb()
    .prepare("SELECT id, name, short, hue FROM subjects ORDER BY id")
    .all() as Pick<Subject, "id" | "name" | "short" | "hue">[];

  return (
    <html lang="es" className={`${geist.variable} dark h-full`}>
      <body className="flex h-full bg-slate-950 text-slate-100 antialiased">
        <Sidebar subjects={subjects} />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </body>
    </html>
  );
}
