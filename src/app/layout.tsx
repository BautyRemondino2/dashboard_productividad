import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import PomodoroTimer from "@/components/PomodoroTimer";
import CommandPalette from "@/components/CommandPalette";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Dashboard · Facultad",
  description: "Dashboard personal de facultad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} dark h-full`}>
      <body className="flex flex-col h-full bg-slate-950 text-slate-100 antialiased">
        <TopNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <PomodoroTimer />
        <CommandPalette />
      </body>
    </html>
  );
}
