/**
 * El perfil de un papel: qué clase de negocio es, para que la ficha pregunte
 * lo que corresponde.
 *
 * La ficha de análisis era una sola plantilla de 43 campos para las 2.126
 * empresas del universo, y en cualquier papel concreto sobraba medio
 * formulario. A una empresa de software de Texas le preguntaba si cobra en
 * pesos y debe en dólares, y le ofrecía "toneladas, m² alquilados" como driver
 * de ingresos; a un banco le pedía el margen bruto. Un cuestionario que no es
 * de esta empresa no se contesta: se saltea.
 *
 * ## De dónde sale
 *
 * Del **sector GICS** y sobre todo de la **industria de Nasdaq**, que es mucho
 * más fina: "Computer Software: Prepackaged Software", "Major Banks",
 * "Precious Metals". Ambos vienen en el universo, así que clasificar no cuesta
 * un request. La geografía sale aparte: `argentino` decide si la ficha
 * pregunta por descalce de monedas y retenciones o por exposición geográfica.
 *
 * ## Por qué así de gruesa
 *
 * Dieciséis perfiles, no cincuenta. La granularidad tiene que ser la de las
 * preguntas que cambian: una aerolínea y una naviera comparten casi todo lo
 * que uno le pregunta a un transporte —utilización, tarifa, costo de
 * combustible— y separarlas sólo agregaría entradas a una tabla. Cuando una
 * industria no cae en ninguno, `generico` deja la plantilla como estaba: es un
 * cuestionario que sirve para cualquier empresa, que es exactamente el
 * problema y también la red de contención.
 */

import type { Sector } from "@/lib/equity-sectores";

export const PERFILES = [
  "software",
  "semis",
  "hardware",
  "biotech",
  "salud",
  "banco",
  "seguros",
  "gestora",
  "reit",
  "energia",
  "minera",
  "utility",
  "industrial",
  "consumo",
  "medios",
  "transporte",
  "generico",
] as const;

export type Perfil = (typeof PERFILES)[number];

/** Cómo se nombra el perfil en pantalla, para que se vea qué plantilla salió. */
export const PERFIL_LABEL: Record<Perfil, string> = {
  software: "software y servicios",
  semis: "semiconductores",
  hardware: "hardware y equipos",
  biotech: "farmacéutica y biotecnología",
  salud: "salud y equipamiento médico",
  banco: "banco",
  seguros: "seguros",
  gestora: "gestión de activos y mercado de capitales",
  reit: "inmobiliario (REIT)",
  energia: "petróleo y gas",
  minera: "minería",
  utility: "servicio público regulado",
  industrial: "industrial",
  consumo: "consumo y retail",
  medios: "telecomunicaciones y medios",
  transporte: "transporte y logística",
  generico: "general",
};

/**
 * Las reglas, en orden: gana la primera que matchea contra la industria.
 *
 * Van sobre la industria de Nasdaq porque es la que discrimina. El orden
 * importa en los solapamientos reales: "Finance: Consumer Services" es un banco
 * de consumo y tiene que caer en `banco` antes de que `consumo` lo agarre por
 * la palabra.
 */
const REGLAS: { perfil: Perfil; rx: RegExp }[] = [
  { perfil: "banco", rx: /\bbank|savings inst|finance: consumer services|finance compan|thrift/i },
  { perfil: "seguros", rx: /insur|accident.*health/i },
  { perfil: "gestora", rx: /investment (manager|banker|broker)|brokers|asset manag/i },
  { perfil: "reit", rx: /real estate/i },
  { perfil: "semis", rx: /semiconductor|electronic components/i },
  { perfil: "software", rx: /software|edp services|computer periph.*data|programming data|business services|internet/i },
  { perfil: "hardware", rx: /telecommunications equipment|computer (manufacturing|communication)|consumer electronics|office equipment|industrial machinery\/components.*comput/i },
  { perfil: "salud", rx: /laboratory analytical|diagnostic|medical\/dental instrument/i },
  { perfil: "biotech", rx: /biotechnology|pharmac|major pharma/i },
  { perfil: "salud", rx: /medical|health (industr|services)|hospital|dental/i },
  { perfil: "energia", rx: /oil|gas (distribution|production|transmission)|natural gas|oilfield/i },
  { perfil: "minera", rx: /precious metals|metal mining|steel\/iron|mining|quarrying|gold|aluminum|coal/i },
  { perfil: "utility", rx: /utilit|power generation|water supply|electric power/i },
  { perfil: "medios", rx: /broadcast|cable|telecommunication|television|movies|publishing|advertising|newspapers/i },
  { perfil: "transporte", rx: /transport|trucking|marine|air freight|airlines|railroad|shipping/i },
  { perfil: "consumo", rx: /restaurant|retail|food|beverage|apparel|hotel|package goods|cosmetics|consumer|recreation|home ?build|farming|tobacco|shoe|department/i },
  { perfil: "industrial", rx: /machinery|aerospace|military|metal fabric|chemical|container|packaging|construction|engineering|auto|electrical products|industrial|specialt(y|ies) chem|building/i },
];

/** Cuando la industria no dice nada, el sector GICS alcanza para no errarle feo. */
const POR_SECTOR: Partial<Record<Sector, Perfil>> = {
  "Information Technology": "software",
  "Health Care": "salud",
  Financials: "banco",
  "Real Estate": "reit",
  Energy: "energia",
  Materials: "minera",
  Utilities: "utility",
  Industrials: "industrial",
  "Consumer Discretionary": "consumo",
  "Consumer Staples": "consumo",
  "Communication Services": "medios",
};

export interface PerfilPapel {
  id: Perfil;
  label: string;
  /** ADR argentino: cambia lo que se pregunta sobre monedas y regulación. */
  argentino: boolean;
}

export function perfilDe({
  sector,
  industria,
  argentino = false,
}: {
  sector: Sector;
  industria: string | null;
  argentino?: boolean;
}): PerfilPapel {
  const id =
    (industria ? REGLAS.find((r) => r.rx.test(industria))?.perfil : undefined) ??
    POR_SECTOR[sector] ??
    "generico";

  return { id, label: PERFIL_LABEL[id], argentino };
}
