/**
 * Traducción de las descripciones de empresa, gratis.
 *
 * Yahoo las publica sólo en inglés —verificado contra `es-AR`, `es-ES` y
 * `es-MX`: siempre devuelve el original—. Antes esto pasaba por Claude, que
 * traduce mejor pero cuesta plata en cada pasada y obliga a tener una clave
 * configurada. MyMemory hace un trabajo suficiente para una descripción de
 * negocio y no cuesta nada.
 *
 * Dos límites del servicio, ya contemplados acá:
 *
 *   - **500 caracteres por pedido.** Las descripciones promedian 1.550, así que
 *     se parten por oración y se rearman.
 *   - **Cuota diaria.** Sin registrar son ~5.000 caracteres; con un mail
 *     registrado, 50.000, que alcanzan para unas 32 empresas por día. Cuando se
 *     agota, la ficha vuelve a mostrar el original en vez de romperse.
 */

const API = "https://api.mymemory.translated.net/get";
const MAX_PEDIDO = 500;

// ─── Caché ──────────────────────────────────────────────────────────────────

interface Entrada {
  valor: string | null;
  vence: number;
}

declare global {
  var __traduccionCache: Map<string, Entrada> | undefined;
}

const cache = (globalThis.__traduccionCache ??= new Map<string, Entrada>());

/** Vacía el caché de traducciones. */
export function invalidarTraducciones() {
  cache.clear();
}

// ─── Partido en trozos ──────────────────────────────────────────────────────

/**
 * Parte el texto en trozos de menos de 500 caracteres, cortando por oración.
 * Cortar al medio de una frase le saca el contexto al traductor y se nota.
 */
function partir(texto: string): string[] {
  const oraciones = texto.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [texto];
  const trozos: string[] = [];
  let actual = "";

  for (const oracion of oraciones) {
    // Una oración sola más larga que el límite: se corta por palabras
    if (oracion.length > MAX_PEDIDO) {
      if (actual) { trozos.push(actual.trim()); actual = ""; }
      let resto = oracion;
      while (resto.length > MAX_PEDIDO) {
        const corte = resto.lastIndexOf(" ", MAX_PEDIDO);
        trozos.push(resto.slice(0, corte > 0 ? corte : MAX_PEDIDO).trim());
        resto = resto.slice(corte > 0 ? corte : MAX_PEDIDO);
      }
      actual = resto;
      continue;
    }

    if (actual.length + oracion.length > MAX_PEDIDO) {
      trozos.push(actual.trim());
      actual = oracion;
    } else {
      actual += oracion;
    }
  }
  if (actual.trim()) trozos.push(actual.trim());
  return trozos.filter(Boolean);
}

// ─── Traducción ─────────────────────────────────────────────────────────────

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RespuestaMyMemory {
  responseStatus?: number | string;
  responseData?: { translatedText?: string };
}

async function traducirTrozo(trozo: string): Promise<string | null> {
  // El mail registrado sube la cuota diaria de 5.000 a 50.000 caracteres
  const mail = process.env.MYMEMORY_EMAIL;
  const url =
    `${API}?q=${encodeURIComponent(trozo)}&langpair=en|es` +
    (mail ? `&de=${encodeURIComponent(mail)}` : "");

  const r = await fetch(url, { headers: { "user-agent": "personal-dashboard/1.0" } });
  if (!r.ok) return null;

  const j = (await r.json()) as RespuestaMyMemory;
  // Devuelve 200 en el HTTP y el error adentro del cuerpo
  if (Number(j.responseStatus) !== 200) return null;

  const texto = j.responseData?.translatedText;
  return texto && texto.trim() ? texto : null;
}

/**
 * Traduce una descripción al castellano. Devuelve null si no se pudo —por
 * cuota agotada o por caída del servicio— y entonces la ficha muestra el
 * original, que es preferible a un hueco.
 */
export function traducirDescripcion(clave: string, texto: string): Promise<string | null> {
  if (!texto.trim()) return Promise.resolve(null);

  const hit = cache.get(clave);
  if (hit && hit.vence > Date.now()) return Promise.resolve(hit.valor);

  const promesa = (async () => {
    const trozos = partir(texto);
    const salida: string[] = [];

    for (const trozo of trozos) {
      const t = await traducirTrozo(trozo).catch(() => null);
      // Si un trozo falla se corta: media descripción traducida y media en
      // inglés se lee peor que el original entero
      if (!t) return null;
      salida.push(t);
      await dormir(250); // el servicio corta si se lo consulta muy seguido
    }

    return salida.join(" ").replace(/\s+/g, " ").trim() || null;
  })();

  // Se guarda la promesa: dos visitas simultáneas no gastan cuota dos veces
  cache.set(clave, { valor: null, vence: Date.now() + 30 * 86400 * 1000 });
  promesa.then(
    (valor) => {
      if (valor) cache.set(clave, { valor, vence: Date.now() + 30 * 86400 * 1000 });
      else cache.delete(clave); // un fallo no se cachea: mañana hay cuota nueva
    },
    () => cache.delete(clave)
  );

  return promesa;
}
