/**
 * Datos económicos por provincia, de fuentes oficiales argentinas.
 *
 * Lo que se puede y lo que no:
 *
 *   ✅ Exportaciones — INDEC vía la API de series de datos.gob.ar, anual.
 *   ✅ Asalariados registrados del sector privado — SSPM, mensual y al día.
 *   ❌ Producto Bruto Geográfico — Argentina no lo publica de forma regular ni
 *      comparable entre provincias; no está en ninguna API del Estado.
 *   ❌ Empleo público provincial — sólo hay serie nacional, sin desagregar.
 *
 * Los dos huecos se dicen en la UI en vez de rellenarse con estimaciones.
 */
import { PROVINCIAS } from "@/lib/provincias";

const API_SERIES = "https://apis.datos.gob.ar/series/api";
const CSV_EMPLEO =
  "https://infra.datos.gob.ar/catalog/sspm/dataset/154/distribution/154.1/download/asalariados-registrados-sector-privado-segun-provincia-datos-con-estacionalidad.csv";

// ─── Caché ──────────────────────────────────────────────────────────────────

interface Entrada<T> {
  valor: T;
  vence: number;
}

declare global {
  var __macroCache: Map<string, Entrada<unknown>> | undefined;
}

const cache = (globalThis.__macroCache ??= new Map<string, Entrada<unknown>>());

async function memo<T>(clave: string, ttlSegundos: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return hit.valor as T;
  const promesa = fn();
  cache.set(clave, { valor: promesa, vence: Date.now() + ttlSegundos * 1000 });
  try {
    return await promesa;
  } catch (e) {
    cache.delete(clave);
    throw e;
  }
}

export function invalidarCacheMacro() {
  cache.clear();
}

// ─── Empleo privado registrado ──────────────────────────────────────────────

/** Columna del CSV para cada jurisdicción. */
const COLUMNA_EMPLEO: Record<string, string> = {
  "AR-B": "asalariados_priv_buenos_aires",
  "AR-C": "asalariados_priv_caba",
  "AR-K": "asalariados_priv_catamarca",
  "AR-H": "asalariados_priv_chaco",
  "AR-U": "asalariados_priv_chubut",
  "AR-X": "asalariados_priv_cordoba",
  "AR-W": "asalariados_priv_corrientes",
  "AR-E": "asalariados_priv_entre_rios",
  "AR-P": "asalariados_priv_formosa",
  "AR-Y": "asalariados_priv_jujuy",
  "AR-L": "asalariados_priv_la_pampa",
  "AR-F": "asalariados_priv_la_rioja",
  "AR-M": "asalariados_priv_mendoza",
  "AR-N": "asalariados_priv_misiones",
  "AR-Q": "asalariados_priv_neuquen",
  "AR-R": "asalariados_priv_rio_negro",
  "AR-A": "asalariados_priv_salta",
  "AR-J": "asalariados_priv_san_juan",
  "AR-D": "asalariados_priv_san_luis",
  "AR-Z": "asalariados_priv_santa_cruz",
  "AR-S": "asalariados_priv_santa_fe",
  "AR-G": "asalariados_priv_santiago_estero",
  "AR-V": "asalariados_priv_tierra_fuego",
  "AR-T": "asalariados_priv_tucuman",
};

export interface EmpleoProvincial {
  /** Miles de asalariados privados registrados. */
  nivel: number;
  /** Variación contra el mismo mes del año anterior, en %. */
  interanual: number | null;
  /** Mes del dato, en ISO. */
  fecha: string;
}

/**
 * Empleo privado registrado por provincia. Es el mejor termómetro disponible
 * de cómo viene cada economía provincial: se publica mensual, cubre las 24
 * jurisdicciones y no depende de estimaciones propias.
 */
export function getEmpleoProvincial(): Promise<Record<string, EmpleoProvincial>> {
  return memo("empleo-provincial", 6 * 3600, async () => {
    const r = await fetch(CSV_EMPLEO, { headers: { "user-agent": "personal-dashboard" } });
    if (!r.ok) throw new Error(`El CSV de empleo respondió ${r.status}`);

    const filas = (await r.text()).trim().split("\n").map((l) => l.split(","));
    const [cabecera, ...datos] = filas;
    if (datos.length < 13) throw new Error("El CSV de empleo vino con muy pocas filas");

    const ultima = datos[datos.length - 1];
    // Doce filas atrás es el mismo mes del año anterior: la serie es mensual
    const haceUnAnio = datos[datos.length - 13];

    const salida: Record<string, EmpleoProvincial> = {};
    for (const [iso, columna] of Object.entries(COLUMNA_EMPLEO)) {
      const i = cabecera.indexOf(columna);
      if (i < 0) continue;

      const nivel = Number(ultima[i]);
      const previo = Number(haceUnAnio?.[i]);
      if (!Number.isFinite(nivel)) continue;

      salida[iso] = {
        nivel,
        interanual: Number.isFinite(previo) && previo > 0 ? (nivel / previo - 1) * 100 : null,
        fecha: ultima[0],
      };
    }
    return salida;
  });
}

// ─── Exportaciones ──────────────────────────────────────────────────────────

/** Cómo se llama cada provincia dentro de los IDs de la API de series. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

export interface ExportacionesProvincia {
  /** Millones de dólares del último año disponible. */
  monto: number;
  anio: string;
  /** Variación contra el año anterior, en %. */
  interanual: number | null;
}

/**
 * Exportaciones por provincia, del dataset del INDEC.
 *
 * Los IDs de serie no siguen un patrón deducible ("350.1_JUJUY_TOTAJUY__17"),
 * así que primero se busca el catálogo y se emparejan por descripción. Todo
 * cacheado un día: es una serie anual.
 */
export function getExportacionesProvinciales(): Promise<Record<string, ExportacionesProvincia>> {
  return memo("exportaciones-provinciales", 86400, async () => {
    // 1. El catálogo, para descubrir el ID de cada provincia.
    // Ojo: el parámetro `dataset_title` no filtra nada —devuelve cualquier cosa,
    // incluidas estadísticas criminales—. Hay que buscar por texto.
    const cat = await fetch(`${API_SERIES}/search/?q=exportaciones+total&limit=300`);
    if (!cat.ok) throw new Error(`El catálogo de series respondió ${cat.status}`);

    const catalogo = (await cat.json()) as {
      data?: { field?: { id?: string; description?: string } }[];
    };

    const idPorProvincia = new Map<string, string>();
    for (const p of PROVINCIAS) {
      const clave = normalizar(p.nombre === "CABA" ? "ciudad de buenos aires" : p.nombre);
      // Las series de total repiten el nombre: "Exportaciones jujuy total jujuy"
      const hit = (catalogo.data ?? []).find(
        (d) => normalizar(String(d.field?.description ?? "")) === `exportaciones${clave}total${clave}`
      );
      if (hit?.field?.id) idPorProvincia.set(p.iso, hit.field.id);
    }
    if (idPorProvincia.size === 0) return {};

    // 2. Los valores, en un solo pedido
    const ids = [...idPorProvincia.values()];
    const salida: Record<string, ExportacionesProvincia> = {};

    // La API limita cuántas series se piden juntas; se va de a 20
    for (let i = 0; i < ids.length; i += 20) {
      const tanda = ids.slice(i, i + 20);
      const r = await fetch(
        `${API_SERIES}/series/?ids=${tanda.join(",")}&limit=2&sort=desc&format=json`
      );
      if (!r.ok) continue;

      const j = (await r.json()) as { data?: (string | number | null)[][] };
      const filas = j.data ?? [];
      if (filas.length === 0) continue;

      // El formato es [fecha, serie1, serie2, …] con las filas más nuevas primero
      const ultima = filas[0];
      const previa = filas[1];

      tanda.forEach((id, col) => {
        const iso = [...idPorProvincia.entries()].find(([, v]) => v === id)?.[0];
        if (!iso) return;

        const monto = Number(ultima?.[col + 1]);
        const antes = Number(previa?.[col + 1]);
        if (!Number.isFinite(monto)) return;

        salida[iso] = {
          monto,
          anio: String(ultima?.[0] ?? "").slice(0, 4),
          interanual: Number.isFinite(antes) && antes > 0 ? (monto / antes - 1) * 100 : null,
        };
      });
    }
    return salida;
  });
}

// ─── Todo junto ─────────────────────────────────────────────────────────────

export interface DatosProvincia {
  empleo: EmpleoProvincial | null;
  exportaciones: ExportacionesProvincia | null;
}

/** Los datos económicos de las 24, con lo que haya. Si una fuente falla, la otra igual sale. */
export async function getDatosProvinciales(): Promise<Record<string, DatosProvincia>> {
  const [empleo, expo] = await Promise.all([
    getEmpleoProvincial().catch(() => ({} as Record<string, EmpleoProvincial>)),
    getExportacionesProvinciales().catch(() => ({} as Record<string, ExportacionesProvincia>)),
  ]);

  const salida: Record<string, DatosProvincia> = {};
  for (const p of PROVINCIAS) {
    salida[p.iso] = {
      empleo: empleo[p.iso] ?? null,
      exportaciones: expo[p.iso] ?? null,
    };
  }
  return salida;
}
