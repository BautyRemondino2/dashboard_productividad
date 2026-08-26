/**
 * Empleo privado y exportaciones por provincia, ya resueltos.
 *
 * Generado por `node scripts/generar-datos-provincias.mjs` el 2026-08-26.
 * No editar a mano.
 *
 * Empleo: SSPM, mes 2026-05-01. Exportaciones: INDEC, año 2024.
 *
 * Está en el repo y no se pide en vivo porque armarlo son 27 requests
 * secuenciales a las APIs del Estado, y el empleo se publica una vez por mes y
 * las exportaciones una vez por año. Para actualizarlo, correr el generador.
 */

import type { Rubro } from "@/lib/macro-provincias";

export interface EmpleoProvincial {
  /** Miles de asalariados privados registrados. */
  nivel: number;
  /** Variación contra el mismo mes del año anterior, en %. */
  interanual: number | null;
  /** Mes del dato, en ISO. */
  fecha: string;
}

export interface ExportacionesProvincia {
  /** Millones de dólares del último año disponible. */
  monto: number;
  anio: string;
  /** Variación contra el año anterior, en %. */
  interanual: number | null;
  /** Peso de cada rubro dentro del total, en %. */
  composicion: { rubro: Rubro; monto: number; peso: number }[];
  /** A dónde va, de mayor a menor. Sin "Resto", que no es un destino. */
  destinos: { pais: string; monto: number; peso: number }[];
  /** Cuánto del total cubren los destinos listados, en %. */
  destinosCubren: number;
}

/** Cuándo se generó y qué período cubre cada serie. */
export const VIGENCIA = {
  generado: "2026-08-26",
  mesEmpleo: "2026-05-01",
  anioExportaciones: "2024",
} as const;

export const EMPLEO: Record<string, EmpleoProvincial> = {
  "AR-B": {
    "nivel": 1925.2,
    "interanual": -2.425,
    "fecha": "2026-05-01"
  },
  "AR-C": {
    "nivel": 1477.5,
    "interanual": -2.185,
    "fecha": "2026-05-01"
  },
  "AR-K": {
    "nivel": 34.9,
    "interanual": -3.808,
    "fecha": "2026-05-01"
  },
  "AR-H": {
    "nivel": 69.7,
    "interanual": -5.061,
    "fecha": "2026-05-01"
  },
  "AR-U": {
    "nivel": 85.8,
    "interanual": -5.824,
    "fecha": "2026-05-01"
  },
  "AR-X": {
    "nivel": 511.7,
    "interanual": -1.983,
    "fecha": "2026-05-01"
  },
  "AR-W": {
    "nivel": 75.6,
    "interanual": -5.454,
    "fecha": "2026-05-01"
  },
  "AR-E": {
    "nivel": 134,
    "interanual": -1.396,
    "fecha": "2026-05-01"
  },
  "AR-P": {
    "nivel": 21.8,
    "interanual": -5.108,
    "fecha": "2026-05-01"
  },
  "AR-Y": {
    "nivel": 54.5,
    "interanual": -3.712,
    "fecha": "2026-05-01"
  },
  "AR-L": {
    "nivel": 38.1,
    "interanual": -2.008,
    "fecha": "2026-05-01"
  },
  "AR-F": {
    "nivel": 30.3,
    "interanual": -1.654,
    "fecha": "2026-05-01"
  },
  "AR-M": {
    "nivel": 232.5,
    "interanual": -3.877,
    "fecha": "2026-05-01"
  },
  "AR-N": {
    "nivel": 100.2,
    "interanual": -6.134,
    "fecha": "2026-05-01"
  },
  "AR-Q": {
    "nivel": 153.3,
    "interanual": 3.987,
    "fecha": "2026-05-01"
  },
  "AR-R": {
    "nivel": 111.3,
    "interanual": 3.66,
    "fecha": "2026-05-01"
  },
  "AR-A": {
    "nivel": 116.7,
    "interanual": -3.307,
    "fecha": "2026-05-01"
  },
  "AR-J": {
    "nivel": 81.3,
    "interanual": 2.503,
    "fecha": "2026-05-01"
  },
  "AR-D": {
    "nivel": 50.9,
    "interanual": -3.405,
    "fecha": "2026-05-01"
  },
  "AR-Z": {
    "nivel": 49.6,
    "interanual": -4.511,
    "fecha": "2026-05-01"
  },
  "AR-S": {
    "nivel": 505.7,
    "interanual": -1.194,
    "fecha": "2026-05-01"
  },
  "AR-G": {
    "nivel": 49.3,
    "interanual": -1.505,
    "fecha": "2026-05-01"
  },
  "AR-V": {
    "nivel": 30.8,
    "interanual": -12.334,
    "fecha": "2026-05-01"
  },
  "AR-T": {
    "nivel": 167.5,
    "interanual": -1.183,
    "fecha": "2026-05-01"
  }
};

export const EXPORTACIONES: Record<string, ExportacionesProvincia> = {
  "AR-E": {
    "monto": 1396.5,
    "anio": "2024",
    "interanual": 25.36,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 779.4,
        "peso": 100
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 276.4,
        "peso": 19.79
      },
      {
        "pais": "China",
        "monto": 179.3,
        "peso": 12.84
      },
      {
        "pais": "Chile",
        "monto": 96.2,
        "peso": 6.89
      },
      {
        "pais": "Estados Unidos",
        "monto": 77.1,
        "peso": 5.52
      }
    ],
    "destinosCubren": 45.04
  },
  "AR-A": {
    "monto": 1279.8,
    "anio": "2024",
    "interanual": 16.222,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 835.2,
        "peso": 72.5
      },
      {
        "rubro": "moi",
        "monto": 316.8,
        "peso": 27.5
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 259,
        "peso": 20.24
      },
      {
        "pais": "China",
        "monto": 119.2,
        "peso": 9.31
      },
      {
        "pais": "Bélgica",
        "monto": 84.8,
        "peso": 6.63
      },
      {
        "pais": "Brasil",
        "monto": 75.2,
        "peso": 5.88
      }
    ],
    "destinosCubren": 42.06
  },
  "AR-Y": {
    "monto": 1060.4,
    "anio": "2024",
    "interanual": 0.075,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 465.2,
        "peso": 43.87
      },
      {
        "rubro": "moi",
        "monto": 425.9,
        "peso": 40.16
      },
      {
        "rubro": "moa",
        "monto": 169.3,
        "peso": 15.97
      }
    ],
    "destinos": [
      {
        "pais": "China",
        "monto": 508.2,
        "peso": 47.93
      },
      {
        "pais": "Bélgica",
        "monto": 124.8,
        "peso": 11.77
      },
      {
        "pais": "Estados Unidos",
        "monto": 109.6,
        "peso": 10.34
      },
      {
        "pais": "Chile",
        "monto": 54.6,
        "peso": 5.15
      }
    ],
    "destinosCubren": 75.19
  },
  "AR-P": {
    "monto": 37.1,
    "anio": "2024",
    "interanual": 79.613,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 4.5,
        "peso": 93.75
      },
      {
        "rubro": "moi",
        "monto": 0.3,
        "peso": 6.25
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 6.5,
        "peso": 17.52
      },
      {
        "pais": "Chile",
        "monto": 4.3,
        "peso": 11.59
      },
      {
        "pais": "China",
        "monto": 3.8,
        "peso": 10.24
      },
      {
        "pais": "España",
        "monto": 3.3,
        "peso": 8.89
      }
    ],
    "destinosCubren": 48.24
  },
  "AR-N": {
    "monto": 440.6,
    "anio": "2024",
    "interanual": 21.287,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 250,
        "peso": 56.74
      },
      {
        "rubro": "moi",
        "monto": 138.8,
        "peso": 31.5
      },
      {
        "rubro": "pp",
        "monto": 51.8,
        "peso": 11.76
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 100,
        "peso": 22.7
      },
      {
        "pais": "Brasil",
        "monto": 91.2,
        "peso": 20.7
      },
      {
        "pais": "Siria",
        "monto": 55.6,
        "peso": 12.62
      },
      {
        "pais": "China",
        "monto": 53.3,
        "peso": 12.1
      }
    ],
    "destinosCubren": 68.12
  },
  "AR-H": {
    "monto": 401.7,
    "anio": "2024",
    "interanual": 32.551,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 326.6,
        "peso": 81.3
      },
      {
        "rubro": "moa",
        "monto": 70.4,
        "peso": 17.53
      },
      {
        "rubro": "moi",
        "monto": 4.7,
        "peso": 1.17
      }
    ],
    "destinos": [
      {
        "pais": "China",
        "monto": 110.9,
        "peso": 27.61
      },
      {
        "pais": "Chile",
        "monto": 19.8,
        "peso": 4.93
      },
      {
        "pais": "Brasil",
        "monto": 18.1,
        "peso": 4.51
      },
      {
        "pais": "Italia",
        "monto": 14.7,
        "peso": 3.66
      }
    ],
    "destinosCubren": 40.71
  },
  "AR-W": {
    "monto": 257.7,
    "anio": "2024",
    "interanual": 10.063,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 103.1,
        "peso": 100
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 49.6,
        "peso": 19.25
      },
      {
        "pais": "Brasil",
        "monto": 27.4,
        "peso": 10.63
      },
      {
        "pais": "Chile",
        "monto": 23.9,
        "peso": 9.27
      },
      {
        "pais": "España",
        "monto": 20.7,
        "peso": 8.03
      }
    ],
    "destinosCubren": 47.18
  },
  "AR-K": {
    "monto": 325.2,
    "anio": "2024",
    "interanual": 17.651,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 281.6,
        "peso": 100
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 5.1,
        "peso": 1.57
      },
      {
        "pais": "España",
        "monto": 3.5,
        "peso": 1.08
      },
      {
        "pais": "Corea del Sur",
        "monto": 1.6,
        "peso": 0.49
      },
      {
        "pais": "Filipinas",
        "monto": 0.3,
        "peso": 0.09
      }
    ],
    "destinosCubren": 3.23
  },
  "AR-F": {
    "monto": 181.6,
    "anio": "2024",
    "interanual": -8.721,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 112.5,
        "peso": 64.43
      },
      {
        "rubro": "moi",
        "monto": 62.1,
        "peso": 35.57
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 76.7,
        "peso": 42.24
      },
      {
        "pais": "Chile",
        "monto": 47.3,
        "peso": 26.05
      },
      {
        "pais": "Estados Unidos",
        "monto": 34.4,
        "peso": 18.94
      },
      {
        "pais": "Uruguay",
        "monto": 9.1,
        "peso": 5.01
      }
    ],
    "destinosCubren": 92.24
  },
  "AR-J": {
    "monto": 1820.7,
    "anio": "2024",
    "interanual": 56.925,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 1593.1,
        "peso": 87.5
      },
      {
        "rubro": "moa",
        "monto": 154.8,
        "peso": 8.5
      },
      {
        "rubro": "pp",
        "monto": 72.8,
        "peso": 4
      }
    ],
    "destinos": [
      {
        "pais": "Suiza",
        "monto": 919.3,
        "peso": 50.49
      },
      {
        "pais": "Brasil",
        "monto": 109.7,
        "peso": 6.03
      },
      {
        "pais": "Chile",
        "monto": 74.7,
        "peso": 4.1
      },
      {
        "pais": "Estados Unidos",
        "monto": 73.3,
        "peso": 4.03
      }
    ],
    "destinosCubren": 64.65
  },
  "AR-M": {
    "monto": 1566.3,
    "anio": "2024",
    "interanual": 19.489,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 1006.1,
        "peso": 80.12
      },
      {
        "rubro": "moi",
        "monto": 249.6,
        "peso": 19.88
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 441.5,
        "peso": 28.19
      },
      {
        "pais": "Estados Unidos",
        "monto": 319.4,
        "peso": 20.39
      },
      {
        "pais": "Chile",
        "monto": 125.5,
        "peso": 8.01
      },
      {
        "pais": "Reino Unido",
        "monto": 95.6,
        "peso": 6.1
      }
    ],
    "destinosCubren": 62.69
  },
  "AR-Q": {
    "monto": 3807.8,
    "anio": "2024",
    "interanual": 25.342,
    "composicion": [
      {
        "rubro": "cye",
        "monto": 3671.1,
        "peso": 96.41
      },
      {
        "rubro": "moi",
        "monto": 67.4,
        "peso": 1.77
      },
      {
        "rubro": "pp",
        "monto": 55.4,
        "peso": 1.45
      },
      {
        "rubro": "moa",
        "monto": 13.9,
        "peso": 0.37
      }
    ],
    "destinos": [
      {
        "pais": "Chile",
        "monto": 1706.4,
        "peso": 44.81
      },
      {
        "pais": "Estados Unidos",
        "monto": 1141.9,
        "peso": 29.99
      },
      {
        "pais": "Brasil",
        "monto": 370.4,
        "peso": 9.73
      },
      {
        "pais": "Uruguay",
        "monto": 126,
        "peso": 3.31
      }
    ],
    "destinosCubren": 87.84
  },
  "AR-U": {
    "monto": 3509.2,
    "anio": "2024",
    "interanual": 29.866,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 685.9,
        "peso": 88.54
      },
      {
        "rubro": "moa",
        "monto": 88.8,
        "peso": 11.46
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 1227.6,
        "peso": 34.98
      },
      {
        "pais": "Chile",
        "monto": 644.2,
        "peso": 18.36
      },
      {
        "pais": "Brasil",
        "monto": 440.5,
        "peso": 12.55
      },
      {
        "pais": "España",
        "monto": 204.5,
        "peso": 5.83
      }
    ],
    "destinosCubren": 71.72
  },
  "AR-R": {
    "monto": 601,
    "anio": "2024",
    "interanual": 23.827,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 302.1,
        "peso": 50.65
      },
      {
        "rubro": "cye",
        "monto": 184.1,
        "peso": 30.86
      },
      {
        "rubro": "moa",
        "monto": 110.3,
        "peso": 18.49
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 159.3,
        "peso": 26.51
      },
      {
        "pais": "Brasil",
        "monto": 157.7,
        "peso": 26.24
      },
      {
        "pais": "Chile",
        "monto": 83.8,
        "peso": 13.94
      },
      {
        "pais": "Rusia",
        "monto": 28.4,
        "peso": 4.73
      }
    ],
    "destinosCubren": 71.42
  },
  "AR-Z": {
    "monto": 2267.4,
    "anio": "2024",
    "interanual": 6.161,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 1619.5,
        "peso": 71.43
      },
      {
        "rubro": "pp",
        "monto": 315.9,
        "peso": 13.93
      },
      {
        "rubro": "cye",
        "monto": 276.8,
        "peso": 12.21
      },
      {
        "rubro": "moa",
        "monto": 55.2,
        "peso": 2.43
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 694.3,
        "peso": 30.62
      },
      {
        "pais": "Suiza",
        "monto": 692.2,
        "peso": 30.53
      },
      {
        "pais": "Chile",
        "monto": 163,
        "peso": 7.19
      },
      {
        "pais": "Corea del Sur",
        "monto": 74.9,
        "peso": 3.3
      }
    ],
    "destinosCubren": 71.64
  },
  "AR-V": {
    "monto": 412.3,
    "anio": "2024",
    "interanual": 27.119,
    "composicion": [],
    "destinos": [
      {
        "pais": "Chile",
        "monto": 171.3,
        "peso": 41.55
      },
      {
        "pais": "Estados Unidos",
        "monto": 111.7,
        "peso": 27.09
      },
      {
        "pais": "Brasil",
        "monto": 48.3,
        "peso": 11.71
      },
      {
        "pais": "Francia",
        "monto": 9.3,
        "peso": 2.26
      }
    ],
    "destinosCubren": 82.61
  },
  "AR-B": {
    "monto": 29143.6,
    "anio": "2024",
    "interanual": 11.103,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 11247.6,
        "peso": 38.59
      },
      {
        "rubro": "moa",
        "monto": 9430,
        "peso": 32.36
      },
      {
        "rubro": "pp",
        "monto": 5445.6,
        "peso": 18.69
      },
      {
        "rubro": "cye",
        "monto": 3020.4,
        "peso": 10.36
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 7868.4,
        "peso": 27
      },
      {
        "pais": "China",
        "monto": 2196.5,
        "peso": 7.54
      },
      {
        "pais": "Chile",
        "monto": 1554.6,
        "peso": 5.33
      },
      {
        "pais": "Estados Unidos",
        "monto": 1008.2,
        "peso": 3.46
      }
    ],
    "destinosCubren": 43.33
  },
  "AR-C": {
    "monto": 363,
    "anio": "2024",
    "interanual": 14.923,
    "composicion": [],
    "destinos": [
      {
        "pais": "Alemania",
        "monto": 158.5,
        "peso": 43.66
      },
      {
        "pais": "Uruguay",
        "monto": 44.6,
        "peso": 12.29
      },
      {
        "pais": "Paraguay",
        "monto": 34.6,
        "peso": 9.53
      },
      {
        "pais": "España",
        "monto": 13.9,
        "peso": 3.83
      }
    ],
    "destinosCubren": 69.31
  },
  "AR-S": {
    "monto": 14658,
    "anio": "2024",
    "interanual": 26.439,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 1487.8,
        "peso": 52.34
      },
      {
        "rubro": "pp",
        "monto": 1354.9,
        "peso": 47.66
      }
    ],
    "destinos": [
      {
        "pais": "India",
        "monto": 1719.9,
        "peso": 11.73
      },
      {
        "pais": "Brasil",
        "monto": 1377.2,
        "peso": 9.4
      },
      {
        "pais": "China",
        "monto": 1081.7,
        "peso": 7.38
      },
      {
        "pais": "Malasia",
        "monto": 433.7,
        "peso": 2.96
      }
    ],
    "destinosCubren": 31.47
  },
  "AR-T": {
    "monto": 946.6,
    "anio": "2024",
    "interanual": 22.426,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 366.2,
        "peso": 62.29
      },
      {
        "rubro": "pp",
        "monto": 219.2,
        "peso": 37.29
      },
      {
        "rubro": "cye",
        "monto": 2.5,
        "peso": 0.43
      }
    ],
    "destinos": [
      {
        "pais": "Estados Unidos",
        "monto": 252.9,
        "peso": 26.72
      },
      {
        "pais": "Brasil",
        "monto": 165.5,
        "peso": 17.48
      },
      {
        "pais": "Chile",
        "monto": 71.2,
        "peso": 7.52
      },
      {
        "pais": "China",
        "monto": 40.6,
        "peso": 4.29
      }
    ],
    "destinosCubren": 56.01
  },
  "AR-G": {
    "monto": 1317.3,
    "anio": "2024",
    "interanual": 49.487,
    "composicion": [],
    "destinos": [
      {
        "pais": "China",
        "monto": 305.4,
        "peso": 23.18
      },
      {
        "pais": "Vietnam",
        "monto": 168,
        "peso": 12.75
      },
      {
        "pais": "Malasia",
        "monto": 72.7,
        "peso": 5.52
      },
      {
        "pais": "Argelia",
        "monto": 64.5,
        "peso": 4.9
      }
    ],
    "destinosCubren": 46.35
  },
  "AR-D": {
    "monto": 641.7,
    "anio": "2024",
    "interanual": 5.52,
    "composicion": [
      {
        "rubro": "moi",
        "monto": 141,
        "peso": 100
      }
    ],
    "destinos": [
      {
        "pais": "Chile",
        "monto": 85.5,
        "peso": 13.32
      },
      {
        "pais": "China",
        "monto": 65.5,
        "peso": 10.21
      },
      {
        "pais": "Paraguay",
        "monto": 36.9,
        "peso": 5.75
      },
      {
        "pais": "Estados Unidos",
        "monto": 28.7,
        "peso": 4.47
      }
    ],
    "destinosCubren": 33.75
  },
  "AR-L": {
    "monto": 1025.1,
    "anio": "2024",
    "interanual": 31.879,
    "composicion": [
      {
        "rubro": "pp",
        "monto": 776.8,
        "peso": 78.29
      },
      {
        "rubro": "moa",
        "monto": 210.3,
        "peso": 21.2
      },
      {
        "rubro": "moi",
        "monto": 5.1,
        "peso": 0.51
      }
    ],
    "destinos": [
      {
        "pais": "China",
        "monto": 156.8,
        "peso": 15.3
      },
      {
        "pais": "Perú",
        "monto": 71.4,
        "peso": 6.97
      },
      {
        "pais": "Brasil",
        "monto": 59.9,
        "peso": 5.84
      },
      {
        "pais": "Chile",
        "monto": 55.4,
        "peso": 5.4
      }
    ],
    "destinosCubren": 33.51
  },
  "AR-X": {
    "monto": 9964.6,
    "anio": "2024",
    "interanual": 19.976,
    "composicion": [
      {
        "rubro": "moa",
        "monto": 4242,
        "peso": 42.57
      },
      {
        "rubro": "pp",
        "monto": 3981.8,
        "peso": 39.96
      },
      {
        "rubro": "moi",
        "monto": 1718.2,
        "peso": 17.24
      },
      {
        "rubro": "cye",
        "monto": 22.6,
        "peso": 0.23
      }
    ],
    "destinos": [
      {
        "pais": "Brasil",
        "monto": 1659,
        "peso": 16.65
      },
      {
        "pais": "Vietnam",
        "monto": 785.5,
        "peso": 7.88
      },
      {
        "pais": "China",
        "monto": 621.7,
        "peso": 6.24
      },
      {
        "pais": "Chile",
        "monto": 517.3,
        "peso": 5.19
      }
    ],
    "destinosCubren": 35.96
  }
};
