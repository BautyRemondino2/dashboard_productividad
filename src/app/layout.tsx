import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import CommandPalette from "@/components/CommandPalette";
import { DB_IS_EPHEMERAL } from "@/lib/db";
import CintaIndicadores from "@/components/CintaIndicadores";
import { ultimaActualizacion } from "@/lib/cinta";
import { contarPendientes } from "@/lib/radar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Asesor · Dashboard",
  description: "Dashboard personal de asesor financiero — mercado argentino",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // El sello del nav sale de la misma lectura que alimenta la cinta
  let actualizado: string | null = null;
  let radarPendientes = 0;
  try {
    actualizado = ultimaActualizacion();
    radarPendientes = contarPendientes();
  } catch {
    /* sin base: el nav se dibuja igual, sin sello ni contador */
  }

  return (
    <html lang="es" className={`${geist.variable} dark h-full`}>
      {/* El scroll lo maneja el documento y no un contenedor interno: es lo que
          permite que el nav y la cinta queden pegados arriba con `sticky`. */}
      <body className="min-h-full bg-fondo text-cuerpo antialiased pb-16">
        <TopNav
          ephemeral={DB_IS_EPHEMERAL}
          actualizado={actualizado}
          radarPendientes={radarPendientes}
        />
        <CintaIndicadores />
        <main>{children}</main>
        <CommandPalette />
      </body>
    </html>
  );
}
