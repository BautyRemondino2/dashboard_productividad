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

/** Los cuatro grandes rubros con que el INDEC clasifica las exportaciones. */
export const RUBROS = ["pp", "moa", "moi", "cye"] as const;
export type Rubro = (typeof RUBROS)[number];

export const RUBRO_LABEL: Record<Rubro, string> = {
  pp: "Productos primarios",
  moa: "Manufacturas agropecuarias",
  moi: "Manufacturas industriales",
  cye: "Combustibles y energía",
};

export interface ExportacionesProvincia {
  /** Millones de dólares del último año disponible. */
  monto: number;
  anio: string;
  /** Variación contra el año anterior, en %. */
  interanual: number | null;
  /** Peso de cada rubro dentro del total, en %. Vacío si no se pudo desglosar. */
  composicion: { rubro: Rubro; monto: number; peso: number }[];
  /** A dónde va, de mayor a menor. Sin "Resto", que no es un destino. */
  destinos: { pais: string; monto: number; peso: number }[];
  /** Cuánto del total cubren los destinos listados, en %. */
  destinosCubren: number;
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
    const idPorRubro = new Map<string, string>();
    for (const p of PROVINCIAS) {
      const clave = normalizar(p.nombre === "CABA" ? "ciudad de buenos aires" : p.nombre);
      // Las series de total repiten el nombre: "Exportaciones jujuy total jujuy"
      const hit = (catalogo.data ?? []).find(
        (d) => normalizar(String(d.field?.description ?? "")) === `exportaciones${clave}total${clave}`
      );
      if (hit?.field?.id) idPorProvincia.set(p.iso, hit.field.id);

      // Y el desglose: "Exportaciones neuquen cye" para combustibles y energía
      for (const rubro of RUBROS) {
        const r = (catalogo.data ?? []).find(
          (d) => normalizar(String(d.field?.description ?? "")) === `exportaciones${clave}${rubro}`
        );
        if (r?.field?.id) idPorRubro.set(`${p.iso}:${rubro}`, r.field.id);
      }
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
          composicion: [],
          destinos: [],
          destinosCubren: 0,
        };
      });
    }

    // 3. El desglose por rubro, en tandas
    const rubroIds = [...idPorRubro.entries()];
    for (let i = 0; i < rubroIds.length; i += 20) {
      const tanda = rubroIds.slice(i, i + 20);
      const r = await fetch(
        `${API_SERIES}/series/?ids=${tanda.map(([, id]) => id).join(",")}&limit=1&sort=desc&format=json`
      );
      if (!r.ok) continue;

      const j = (await r.json()) as { data?: (string | number | null)[][] };
      const fila = j.data?.[0];
      if (!fila) continue;

      tanda.forEach(([clave], col) => {
        const [iso, rubro] = clave.split(":") as [string, Rubro];
        const monto = Number(fila[col + 1]);
        if (!Number.isFinite(monto) || monto <= 0 || !salida[iso]) return;
        salida[iso].composicion.push({ rubro, monto, peso: 0 });
      });
    }

    // Los pesos se calculan sobre la suma de los rubros y no sobre el total
    // declarado: si algún rubro no vino, así los porcentajes igual cierran.
    for (const v of Object.values(salida)) {
      const suma = v.composicion.reduce((s, c) => s + c.monto, 0);
      if (suma <= 0) { v.composicion = []; continue; }
      for (const c of v.composicion) c.peso = (c.monto / suma) * 100;
      v.composicion.sort((a, b) => b.monto - a.monto);
    }

    // 4. Los destinos: son los que revelan qué hay detrás de cada rubro. San
    // Juan aparece con 87% en "manufacturas industriales", pero su primer
    // destino es Suiza — eso es oro doré, no industria. El INDEC clasifica
    // piedras y metales preciosos dentro de las manufacturas industriales.
    await cargarDestinos(salida);

    return salida;
  });
}

/** Nombre de provincia dentro de las descripciones del dataset de destinos. */
const ALIAS_DESTINO: Record<string, string> = { "AR-B": "pba", "AR-C": "caba" };

/** El INDEC escribe algunos países sin acentos ni eñes. */
const PAIS_LIMPIO: Record<string, string> = {
  Espania: "España",
  "Republica de Corea": "Corea del Sur",
  "Paises Bajos": "Países Bajos",
  Japon: "Japón",
  Belgica: "Bélgica",
  Canada: "Canadá",
  Mexico: "México",
  Peru: "Perú",
  "Reino Unido de Gran Bretania e Irlanda del Norte": "Reino Unido",
};

async function cargarDestinos(salida: Record<string, ExportacionesProvincia>) {
  const cat = await fetch(`${API_SERIES}/search/?q=datos+exportaciones&limit=1000`);
  if (!cat.ok) return;

  const catalogo = (await cat.json()) as {
    data?: { field?: { id?: string; description?: string } }[];
  };

  // Cada serie es "Datos exportaciones <Provincia> <País>"
  const porProvincia = new Map<string, { id: string; pais: string }[]>();

  for (const d of catalogo.data ?? []) {
    const desc = String(d.field?.description ?? "");
    const id = d.field?.id;
    if (!id || !desc.startsWith("Datos exportaciones ")) continue;

    const palabras = desc.slice("Datos exportaciones ".length).trim().split(/\s+/);

    for (const p of PROVINCIAS) {
      const nombreProv = (ALIAS_DESTINO[p.iso] ?? p.nombre).split(/\s+/);
      // Se consumen las palabras del nombre de la provincia una por una: cortar
      // por longitud del texto normalizado no sirve, porque normalizar saca
      // espacios y acentos y las posiciones dejan de coincidir con el original.
      const coincide = nombreProv.every(
        (w, i) => palabras[i] && normalizar(palabras[i]) === normalizar(w)
      );
      if (!coincide) continue;

      const pais = palabras.slice(nombreProv.length).join(" ").trim();
      // "Total <provincia>" es el total, no un destino
      if (!pais || /^total$/i.test(palabras[nombreProv.length] ?? "")) break;

      const lista = porProvincia.get(p.iso) ?? [];
      lista.push({ id, pais: PAIS_LIMPIO[pais] ?? pais });
      porProvincia.set(p.iso, lista);
      break;
    }
  }

  const pedidos = [...porProvincia.entries()].flatMap(([iso, xs]) =>
    xs.map((x) => ({ iso, ...x }))
  );

  for (let i = 0; i < pedidos.length; i += 20) {
    const tanda = pedidos.slice(i, i + 20);
    const r = await fetch(
      `${API_SERIES}/series/?ids=${tanda.map((t) => t.id).join(",")}&limit=1&sort=desc&format=json`
    );
    if (!r.ok) continue;

    const j = (await r.json()) as { data?: (string | number | null)[][] };
    const fila = j.data?.[0];
    if (!fila) continue;

    tanda.forEach((t, col) => {
      const monto = Number(fila[col + 1]);
      if (!Number.isFinite(monto) || monto <= 0 || !salida[t.iso]) return;
      salida[t.iso].destinos.push({ pais: t.pais, monto, peso: 0 });
    });
  }

  for (const v of Object.values(salida)) {
    if (v.monto > 0) for (const d of v.destinos) d.peso = (d.monto / v.monto) * 100;
    // "Resto" es el agregado de lo que el INDEC no desglosa, no un país
    v.destinos = v.destinos
      .filter((d) => !/^resto$/i.test(d.pais))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 4);
    v.destinosCubren = v.destinos.reduce((s, d) => s + d.peso, 0);
  }
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
