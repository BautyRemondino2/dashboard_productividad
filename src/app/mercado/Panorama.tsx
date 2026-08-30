import Link from "next/link";
import Card from "@/components/Card";
import { getTasaFed, getProximasReuniones } from "@/lib/fed";
import { getCurvaTasaFija, breakevenInflacion } from "@/lib/bonos-tasa-fija";
import { getCurvaCer } from "@/lib/bonos-ars";
import { ajustarNelsonSiegel } from "@/lib/nelson-siegel";
import { contarPendientes } from "@/lib/radar";

const pct = (v: number, d = 2) =>
  `${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

function diasHasta(iso: string): number {
  const hoy = new Date();
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

/** La mediana, que no se corre con un instrumento suelto fuera de línea. */
function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function Celda({
  href,
  label,
  valor,
  nota,
  tono = "text-num",
}: {
  href: string;
  label: string;
  valor: string;
  nota: string;
  tono?: string;
}) {
  return (
    <Link
      href={href}
      className="block p-[18px] hover:bg-chip/50 transition-colors min-w-0 group"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenue">
        {label}
      </div>
      <div
        className={`text-[22px] font-semibold tabular-nums tracking-[-0.01em] mt-2 leading-none ${tono}`}
      >
        {valor}
      </div>
      <p className="text-[10.5px] text-meta mt-1.5 leading-relaxed group-hover:text-secundario transition-colors">
        {nota}
      </p>
    </Link>
  );
}

/**
 * Lo que está pasando en el resto del tablero, sin salir de la home.
 *
 * El panel de macro contesta bien las preguntas argentinas, pero desde que hay
 * cinco secciones la mitad de lo que un asesor necesita a la mañana vive en
 * otra página: la tasa de la Fed, lo que paga una Lecap, qué inflación descuenta
 * el mercado, qué llegó por los canales. Esta franja los trae acá con el número
 * de hoy y cada celda es el link a su sección.
 *
 * No repite nada de lo que ya está más abajo. Es deliberado: una franja de
 * resumen que muestre otra vez el dólar y el riesgo país no ahorra ninguna
 * navegación, sólo alarga la página.
 *
 * Cada dato se resuelve por su cuenta y falla por su cuenta: si BYMA o FRED no
 * responden, esa celda no se dibuja y las demás siguen.
 */
export default async function Panorama() {
  const [tasa, proximas, tasaFija, cer, pendientes] = await Promise.all([
    getTasaFed().catch(() => null),
    getProximasReuniones(1).catch(() => []),
    getCurvaTasaFija().catch(() => null),
    getCurvaCer().catch(() => null),
    Promise.resolve().then(() => {
      try {
        return contarPendientes();
      } catch {
        return 0;
      }
    }),
  ]);

  const celdas: React.ReactNode[] = [];

  if (tasa) {
    const prox = proximas[0];
    const dias = prox ? diasHasta(prox.fecha) : null;
    celdas.push(
      <Celda
        key="fed"
        href="/eeuu"
        label="Tasa de la Fed"
        valor={`${pct(tasa.rangoBajo)}–${pct(tasa.rangoAlto)}`}
        nota={
          dias == null
            ? "rango objetivo vigente"
            : dias <= 0
              ? "el FOMC decide hoy"
              : `próxima reunión del FOMC en ${dias} días`
        }
      />
    );
  }

  if (tasaFija && tasaFija.puntos.length > 0) {
    const corta = tasaFija.puntos[0];
    const larga = tasaFija.puntos[tasaFija.puntos.length - 1];
    celdas.push(
      <Celda
        key="lecap"
        href="/renta-fija"
        label="Lecap más corta"
        valor={`${pct(corta.tem)} TEM`}
        nota={`${corta.ticker} a ${corta.dias} días · la más larga paga ${pct(larga.tem)}`}
      />
    );
  }

  if (tasaFija && cer) {
    // La mediana del tramo con dato, que es más estable que tomar un solo bono:
    // el breakeven de una letra puntual se mueve con su propia liquidez.
    const be = breakevenInflacion(tasaFija.puntos, cer.puntos);
    const m = mediana(be.map((b) => b.mensual));
    if (m != null) {
      celdas.push(
        <Celda
          key="breakeven"
          href="/renta-fija"
          label="Inflación implícita"
          valor={`${pct(m)} mensual`}
          nota="la que iguala una Lecap con un Boncer · mediana de la curva"
        />
      );
    }
  }

  if (cer && cer.puntos.length >= 4) {
    // Del ajuste a un plazo redondo, no del bono más largo de la lista: ahí
    // arriba están el Cuasipar y el Discount del canje 2005, que casi no operan
    // y cuya tasa no es la que consigue un cliente hoy.
    const ajuste = ajustarNelsonSiegel(
      cer.puntos.map((p) => ({ ticker: p.ticker, duration: p.duration, tir: p.tir }))
    );
    const clave = ajuste?.plazosClave.find((p) => p.plazo === 1) ?? ajuste?.plazosClave[0];
    if (clave) {
      celdas.push(
        <Celda
          key="cer"
          href="/renta-fija"
          label={`Tasa real a ${clave.plazo} ${clave.plazo === 1 ? "año" : "años"}`}
          valor={pct(clave.tir, 1)}
          nota="lo que paga el Tesoro por encima de la inflación · curva CER ajustada"
        />
      );
    }
  }

  celdas.push(
    <Celda
      key="radar"
      href="/radar"
      label="Radar"
      valor={pendientes > 0 ? String(pendientes) : "—"}
      tono={pendientes > 0 ? "text-num" : "text-meta"}
      nota={
        pendientes > 0
          ? `${pendientes === 1 ? "noticia" : "noticias"} sin leer con relevancia 3 o más`
          : "sin noticias pendientes · pegá un volcado de los canales"
      }
    />
  );

  if (celdas.length <= 1) return null;

  return (
    <Card
      titulo="Panorama"
      nota="Lo que está pasando en el resto del tablero"
      cuerpo={false}
      className="mt-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-divisor">
        {celdas}
      </div>
    </Card>
  );
}
