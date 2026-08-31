/**
 * Persistencia de la ficha de análisis.
 *
 * Separado de `equity-ficha.ts` porque ese lo importa la pantalla: la
 * plantilla y los tipos viajan al navegador, `better-sqlite3` no puede.
 */
import { getDb } from "@/lib/db";
import {
  avanceDe,
  esCampoValido,
  esCheckValido,
  tablaDe,
  type FichaAnalisis,
} from "@/lib/equity-ficha";

const VACIA = (ticker: string): FichaAnalisis => ({
  ticker,
  campos: {},
  tablas: {},
  checks: {},
  actualizado: null,
  creado: null,
});

interface FilaFicha {
  ticker: string;
  datos_json: string;
  actualizado: string;
  created_at: string;
}

function parsear(fila: FilaFicha): FichaAnalisis {
  let datos: Partial<Pick<FichaAnalisis, "campos" | "tablas" | "checks">> = {};
  try {
    datos = JSON.parse(fila.datos_json) as typeof datos;
  } catch {
    // Un JSON roto no puede voltear la página: se lee como ficha vacía y el
    // próximo guardado lo reescribe entero.
  }
  return {
    ticker: fila.ticker,
    campos: datos.campos ?? {},
    tablas: datos.tablas ?? {},
    checks: datos.checks ?? {},
    actualizado: fila.actualizado,
    creado: fila.created_at,
  };
}

/** La ficha de un ticker. Si nunca se escribió, una vacía (no null). */
export function getFichaAnalisis(ticker: string): FichaAnalisis {
  const fila = getDb()
    .prepare("SELECT ticker, datos_json, actualizado, created_at FROM equity_fichas WHERE ticker = ?")
    .get(ticker) as FilaFicha | undefined;
  return fila ? parsear(fila) : VACIA(ticker);
}

function guardar(ficha: FichaAnalisis) {
  const json = JSON.stringify({ campos: ficha.campos, tablas: ficha.tablas, checks: ficha.checks });
  getDb()
    .prepare(
      `INSERT INTO equity_fichas (ticker, datos_json, actualizado)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(ticker) DO UPDATE SET datos_json = excluded.datos_json,
                                         actualizado = excluded.actualizado`
    )
    .run(ficha.ticker, json);
}

/**
 * Escribe un campo. La ficha se crea sola en el primer guardado: entrar a
 * mirar una empresa no debería dejar una ficha vacía en la lista.
 */
export function guardarCampo(ticker: string, clave: string, valor: string): string {
  if (!esCampoValido(clave)) throw new Error(`Campo desconocido: ${clave}`);
  const ficha = getFichaAnalisis(ticker);
  const limpio = valor.trim();
  if (limpio) ficha.campos[clave] = limpio;
  else delete ficha.campos[clave];
  guardar(ficha);
  return new Date().toISOString();
}

export function guardarTabla(ticker: string, clave: string, filas: string[][]): string {
  const spec = tablaDe(clave);
  if (!spec) throw new Error(`Tabla desconocida: ${clave}`);
  const ficha = getFichaAnalisis(ticker);

  // Una tabla sin ninguna celda escrita se borra: así no cuenta como sección
  // empezada ni ocupa lugar en el JSON. En las de filas fijas la primera
  // columna es la etiqueta que pone la plantilla ("< 12 m"), no algo que haya
  // escrito nadie: si contara, una tabla intacta parecería llena.
  const limpias = filas.map((f) => f.map((c) => c.trim()));
  const desdeColumna = spec.filasFijas ? 1 : 0;
  const conAlgo = limpias.some((f) => f.slice(desdeColumna).some(Boolean));

  if (conAlgo) ficha.tablas[clave] = limpias;
  else delete ficha.tablas[clave];
  guardar(ficha);
  return new Date().toISOString();
}

export function alternarCheck(ticker: string, clave: string, valor: boolean): string {
  if (!esCheckValido(clave)) throw new Error(`Ítem desconocido: ${clave}`);
  const ficha = getFichaAnalisis(ticker);
  if (valor) ficha.checks[clave] = true;
  else delete ficha.checks[clave];
  guardar(ficha);
  return new Date().toISOString();
}

export function borrarFicha(ticker: string) {
  getDb().prepare("DELETE FROM equity_fichas WHERE ticker = ?").run(ticker);
}


/** Las fichas empezadas, para marcarlas en el listado de equity. */
export function tickersConFicha(): Map<string, { porcentaje: number; actualizado: string }> {
  const filas = getDb()
    .prepare("SELECT ticker, datos_json, actualizado, created_at FROM equity_fichas")
    .all() as FilaFicha[];

  return new Map(
    filas.map((f) => {
      const ficha = parsear(f);
      return [f.ticker, { porcentaje: avanceDe(ficha).porcentaje, actualizado: f.actualizado }];
    })
  );
}

