/**
 * Puente entre el panel de Mercado y el glosario.
 *
 * Cada instrumento del panel apunta a un término del glosario: el glosario es
 * la única fuente de la definición y el panel sólo la muestra. Los que ya
 * existían (CCL, MEP, BADLAR…) sólo declaran el mapeo; los que faltaban traen
 * su contenido en `seed` y se insertan al abrir la DB (ver seedGlosarioInstrumentos).
 *
 * Los tickers derivados (BRECHA, MERVAL_USD) no viven en market_instruments:
 * se calculan al leer la página, pero también tienen su término.
 */
import type { GlossaryCategory, TermType } from "@/lib/glossary";

export interface DefinicionInstrumento {
  /** Ticker en market_instruments (o derivado del panel). */
  ticker: string;
  /** Término exacto en glossary_terms. */
  term: string;
  /** Sólo para los términos que este módulo tiene que crear. */
  seed?: {
    category: GlossaryCategory;
    term_type: TermType;
    short_def: string;
    detail: string;
    example: string;
  };
}

export const DEFINICIONES_INSTRUMENTOS: DefinicionInstrumento[] = [
  // ── Dólares ───────────────────────────────────────────────────────────────
  {
    ticker: "OFICIAL",
    term: "Dólar oficial",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Tipo de cambio minorista de pizarra: lo que cobra un banco por vender dólares al público.",
      detail:
        "Es el precio al que los bancos venden dólares a personas humanas, y se publica como promedio de las pizarras (el BCRA difunde el del Banco Nación como referencia). Se mueve pegado al mayorista más el margen del banco, porque el banco se fondea en el mercado mayorista. Sobre este precio se aplican después los impuestos que correspondan según el destino de la compra: lo que efectivamente paga el cliente puede quedar bastante por encima de la pizarra. Es el número que la gente llama \"el dólar\" y el que se compara contra el blue o el CCL para hablar de brecha.",
      example:
        "Mayorista a $1.488 y pizarra minorista a $1.510: el margen del banco es de $22, un 1,5%. Un cliente que compra USD 200 paga $302.000 antes de impuestos. Si al mismo tiempo el CCL está en $1.574, la brecha contra el oficial es (1.574-1.510)/1.510 = 4,2%.",
    },
  },
  {
    ticker: "MAYORISTA",
    term: "Dólar mayorista",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Tipo de cambio del MULC (Comunicación A 3500): el que usan bancos, empresas y comercio exterior.",
      detail:
        "Es el precio que se forma en el Mercado Único y Libre de Cambios, donde operan bancos y empresas por montos grandes: liquidación de exportaciones, pago de importaciones, deuda. El BCRA publica la referencia bajo la Comunicación \"A\" 3500 y es la variable que mira el Central cuando decide intervenir comprando o vendiendo reservas. Es el tipo de cambio relevante para la macro —competitividad, balanza comercial, contratos de comercio exterior— mucho más que la pizarra minorista, que es su derivado.",
      example:
        "Un exportador liquida USD 10M a $1.488 y recibe $14.880M. Si el BCRA quiere sostener el precio y aparece oferta de sobra, compra el excedente: emite pesos y suma reservas. Ese es el canal por el que una buena cosecha termina expandiendo la base monetaria.",
    },
  },
  {
    ticker: "BLUE",
    term: "Dólar blue",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Dólar del mercado informal, sin regulación ni registro de la operación.",
      detail:
        "Se opera en efectivo y por fuera del sistema financiero, así que no deja rastro bancario ni tiene límite formal de monto. Su mercado es chico comparado con el MEP o el CCL: por eso reacciona rápido y de manera exagerada a la tensión política o a un salto de expectativas, y sirve más como termómetro de ánimo que como referencia de precios. Cuando el blue se despega del MEP y el CCL, lo que se está midiendo es la demanda de billete físico —turismo, ahorro fuera del sistema, informalidad—, no el valor financiero del dólar.",
      example:
        "Blue a $1.560 con MEP a $1.520: el billete cotiza 2,6% por encima del dólar financiero. Ese premio suele achicarse cuando baja la tensión, y es el primero en ampliarse cuando aparece ruido: mirarlo contra el MEP dice más que mirarlo contra el oficial.",
    },
  },

  // Ya definidos en el glosario
  { ticker: "MEP", term: "Dólar MEP" },
  { ticker: "CCL", term: "CCL" },
  { ticker: "BRECHA", term: "Brecha cambiaria" },

  // ── Tasas en pesos ────────────────────────────────────────────────────────
  {
    ticker: "TAMAR",
    term: "TAMAR",
    seed: {
      category: "Tasas & Curvas",
      term_type: "metrica",
      short_def: "Tasa mayorista de plazos fijos de $1.000 millones o más a 30-35 días en bancos privados.",
      detail:
        "El BCRA la creó en 2024 para tener una referencia mayorista por encima de la BADLAR, que se calcula sobre depósitos desde $1 millón y quedó chica para el tamaño real de las colocaciones institucionales. Se publica como TNA y hoy es la tasa que ordena el resto de las tasas en pesos: los plazos fijos mayoristas, las Lecaps cortas y los bonos a tasa variable se miran contra ella. Al no publicarse más la tasa de política monetaria, TAMAR y BADLAR quedaron como el par de referencia del mercado en pesos.",
      example:
        "TAMAR en 22,9% TNA equivale a una tasa efectiva mensual de 22,9%/12 = 1,91%. Si la inflación mensual esperada es 1,5%, la tasa real es positiva en torno a 0,4% mensual: le conviene al que se queda en pesos. Si la inflación esperada fuera 2,5%, esa misma tasa deja al colocador perdiendo contra los precios.",
    },
  },
  {
    ticker: "PLAZOFIJO",
    term: "Plazo fijo minorista",
    seed: {
      category: "Tasas & Curvas",
      term_type: "instrumento",
      short_def: "Depósito a plazo de personas humanas, típicamente a 30 días, con tasa pactada de antemano.",
      detail:
        "Es el instrumento de ahorro en pesos más usado y el piso contra el que se compara todo lo demás. Cada banco fija su tasa, así que la referencia que se publica es un promedio del sistema y puede diferir bastante de lo que consigue un cliente puntual, sobre todo comparando bancos grandes contra entidades chicas que pagan más para captar depósitos. Está alcanzado por el seguro de garantía de los depósitos hasta el monto vigente, y su rendimiento nominal se compara siempre contra la inflación esperada: la pregunta relevante nunca es cuánto paga, sino cuánto paga por encima de los precios.",
      example:
        "Plazo fijo a 30 días al 19% TNA sobre $1.000.000: interés = $1.000.000 × 19% × 30/365 = $15.616. Si la inflación del mes es 1,8%, el ahorrista perdió poder de compra: ganó 1,56% nominal contra 1,8% de suba de precios. Contra una TAMAR de 22,9%, además está dejando 4 puntos de tasa sobre la mesa por operar en el segmento minorista.",
    },
  },
  { ticker: "BADLAR", term: "BADLAR" },
  { ticker: "CAUCION1", term: "Caución bursátil" },
  { ticker: "TPM", term: "Tasa política monetaria" },

  // ── Inflación ─────────────────────────────────────────────────────────────
  {
    ticker: "IPC",
    term: "IPC",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Índice de Precios al Consumidor del INDEC: variación mensual del costo de la canasta de consumo.",
      detail:
        "Mide cuánto cambió en el mes el precio de una canasta representativa de bienes y servicios de los hogares. El INDEC lo publica a mediados del mes siguiente, con apertura por rubros y por regiones, y es el dato que ancla todo lo demás: define el CER —y con él la UVA y los bonos ajustables—, entra en las paritarias y es la vara contra la que se juzga cualquier tasa en pesos. Conviene leer también el núcleo, que excluye estacionales y regulados: es el que muestra la inercia real de los precios cuando un mes viene distorsionado por tarifas o por frutas y verduras.",
      example:
        "IPC de 1,5% mensual sostenido durante un año equivale a (1,015)^12 - 1 = 19,6% anual, no 18%: el interés compuesto sobre los precios explica por qué bajar la inflación mensual del 2% al 1,5% cambia tanto el número anual.",
    },
  },
  {
    ticker: "IPC_IA",
    term: "Inflación interanual",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Variación del IPC contra el mismo mes del año anterior: la inflación acumulada de los últimos doce meses.",
      detail:
        "Suaviza el ruido de un mes puntual, pero tiene un costo: arrastra lo que pasó hace hasta un año, así que reacciona tarde. En un proceso de desinflación el interanual sigue mostrando números altos durante meses aunque la inflación mensual ya haya bajado, simplemente porque todavía no salieron del cálculo los meses malos. Para leer el presente sirve más anualizar los últimos tres meses; el interanual sirve para contratos, comparaciones históricas y para medir contra qué se está indexando la economía.",
      example:
        "Si los últimos tres meses fueron 1,4%, 1,5% y 1,5%, la inflación anualizada de ese trimestre es (1,0147)^12 - 1 ≈ 19,1%. Si el interanual publicado es 32%, la diferencia entre los dos números es todo lo que ya quedó atrás: la desinflación es real aunque el titular diga 32%.",
    },
  },
  {
    ticker: "UVA",
    term: "UVA",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Unidad de Valor Adquisitivo: unidad de cuenta que se actualiza por CER, es decir por inflación.",
      detail:
        "Creada en 2016 tomando como base el costo de construcción de un metro cuadrado de vivienda dividido por mil, se actualiza diariamente siguiendo al CER. Su función es permitir contratos largos en un país con inflación alta: el crédito hipotecario UVA, los plazos fijos UVA y los alquileres indexados se denominan en esta unidad, de modo que capital e intereses conservan poder de compra. El punto fino es el rezago: el CER sigue al IPC con alrededor de mes y medio de retraso, así que la UVA de hoy refleja la inflación de hace semanas — cuando la inflación se acelera, el ajuste llega tarde y favorece al deudor; cuando desacelera, pasa lo contrario.",
      example:
        "Un plazo fijo UVA de $1.000.000 con UVA a 1.600 compra 625 UVAs. Si al vencimiento la UVA vale 1.632 (2% de inflación acumulada), el capital ajustado es 625 × 1.632 = $1.020.000, más el interés fijo pactado sobre ese ajuste. El rendimiento nunca es \"inflación + tasa\" del mes en curso, sino de la inflación que ya entró al CER.",
    },
  },

  // ── Riesgo y monetario ────────────────────────────────────────────────────
  {
    ticker: "RIESGO_PAIS",
    term: "Riesgo país (EMBI+)",
    seed: {
      category: "Macro Argentina",
      term_type: "metrica",
      short_def: "Sobretasa en puntos básicos que paga la deuda soberana argentina por encima de los Treasuries de EE.UU.",
      detail:
        "Lo calcula JP Morgan como el spread promedio ponderado de los bonos soberanos en dólares contra bonos del Tesoro estadounidense de plazo comparable. Es una medida de probabilidad de default percibida, no una tasa que alguien pague: 1.000 puntos básicos significa que el mercado exige 10 puntos porcentuales más de rendimiento anual para prestarle a la Argentina que a EE.UU. Su nivel define si el país puede volver a financiarse en los mercados internacionales —en la práctica hace falta bajar bien por debajo de los 500 pb para colocar deuda a tasas razonables— y su compresión es el motor de las subas fuertes de los bonos soberanos: cuando el riesgo país cae, los precios suben y las carteras en hard dollar rinden.",
      example:
        "Riesgo país de 700 pb con el Treasury a 10 años en 4,2%: el mercado le pide a un bono argentino comparable 4,2% + 7% = 11,2% de rendimiento. Si el riesgo país comprime a 500 pb, ese mismo bono pasa a rendir 9,2%; con una duration de 5 años, la caída de 200 pb de tasa implica una suba de precio del orden del 10%.",
    },
  },
  { ticker: "RESERVAS", term: "Reservas brutas vs netas" },
  { ticker: "BASE_MON", term: "Base monetaria" },

  // ── Mundo ─────────────────────────────────────────────────────────────────
  {
    ticker: "SPX",
    term: "S&P 500",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Índice de las 500 empresas más grandes de EE.UU., ponderado por capitalización ajustada por free float.",
      detail:
        "Es la referencia global de renta variable: contra él se mide el rendimiento de casi cualquier cartera de acciones y de él salen la beta y la prima de riesgo de mercado que se usan para valuar. Al ponderar por capitalización, las mayores tecnológicas pesan tanto que el índice puede subir con la mayoría de sus miembros planos. Para el mercado local importa por dos vías: marca el apetito de riesgo global —cuando cae fuerte, los activos emergentes suelen caer más— y es el subyacente de los CEDEARs de índice que un cliente puede comprar en pesos.",
      example:
        "Una cartera con beta 1,3 contra el S&P 500: si el índice cae 10%, la cartera cae alrededor de 13%. Ese mismo 1,3 es el número que multiplica la prima de riesgo de mercado al estimar el costo del capital con CAPM.",
    },
  },
  {
    ticker: "FED_FUNDS",
    term: "Tasa de fondos federales",
    seed: {
      category: "Tasas & Curvas",
      term_type: "metrica",
      short_def: "La tasa de política monetaria de EE.UU.: el techo del rango objetivo que fija la Reserva Federal.",
      detail:
        "La Fed no fija un número sino un rango de 25 puntos básicos —por ejemplo 3,50%-3,75%— dentro del cual quiere que se opere el préstamo overnight entre bancos. La tasa que efectivamente resulta de esas operaciones es la *effective federal funds rate*, y suele quedar unos pocos puntos básicos por debajo del techo. La decide el FOMC en ocho reuniones al año, cuatro de las cuales publican además las proyecciones de sus miembros (el \"dot plot\"). Es la tasa desde la que se arma toda la curva en dólares, así que mueve el precio de cualquier activo que se descuente en esa moneda, incluidos los bonos argentinos. Ojo con leer el nivel nominal solo: lo que mide cuánto aprieta la política es la tasa **real**, esto menos la inflación núcleo.",
      example:
        "Con el rango en 3,50%-3,75% y la inflación núcleo del PCE en 3,3%, la tasa real es de apenas 0,3%: pese a un nivel nominal que suena alto, la política monetaria casi no está frenando. Por eso el mercado puede estar descontando subas y no recortes.",
    },
  },
  {
    ticker: "CPI_USA",
    term: "Inflación de EE.UU.",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Variación interanual del índice de precios al consumidor norteamericano.",
      detail:
        "Es el dato que más condiciona a la Reserva Federal y, por esa vía, al precio de todo lo que cotiza en dólares. Se publica mensualmente y se mira en dos versiones: el general, que incluye alimentos y energía, y el núcleo, que los excluye porque son los componentes más volátiles y menos sensibles a la tasa de interés. Conviene tener presente que la meta del 2% de la Fed **no** está definida sobre este índice sino sobre el PCE núcleo, que se publica un mes más tarde y suele correr algo por debajo del IPC. Para un asesor argentino el canal es indirecto pero fuerte: más inflación en EE.UU. implica una Fed más dura, tasas largas más altas y bonos emergentes más baratos.",
      example:
        "IPC general en 3,3% interanual y núcleo en 2,5%: la brecha de ocho décimas es energía y alimentos. Si el núcleo empieza a subir, la Fed reacciona; si sube sólo el general por un salto del petróleo, suele dejarlo pasar.",
    },
  },
  {
    ticker: "VIX",
    term: "VIX",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Volatilidad implícita del S&P 500 a 30 días: el termómetro del miedo del mercado.",
      detail:
        "Se calcula a partir de los precios de las opciones sobre el S&P 500 y expresa, anualizada, la magnitud de movimiento que el mercado está pagando para los próximos treinta días. No dice hacia dónde va a moverse el índice, sólo cuánto. Por debajo de 15 indica calma; entre 15 y 25, normalidad; arriba de 25 el mercado se pone defensivo y arriba de 35 suele haber ventas forzadas. Importa acá porque el apetito por riesgo es el canal por el que las decisiones de la Fed llegan a un bono argentino: cuando el VIX salta, los emergentes se venden primero, incluso sin ninguna noticia local.",
      example:
        "VIX en 14,5 con el spread high yield en 263 pb: condiciones benignas, apetito por riesgo intacto. En un episodio de estrés el VIX salta a 30 y ese spread se abre 150 pb; los Globales caen aunque el riesgo país argentino no haya cambiado por nada propio.",
    },
  },
  {
    ticker: "UST10Y",
    term: "UST 10 años",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Rendimiento del bono del Tesoro de EE.UU. a 10 años: la tasa libre de riesgo de referencia mundial.",
      detail:
        "Es el precio del dinero a largo plazo en dólares y la base sobre la que se apila todo lo demás: el rendimiento exigido a un soberano emergente es esta tasa más su riesgo país. Sube cuando el mercado espera más crecimiento, más inflación o una Reserva Federal más dura, y cada suba encarece el financiamiento de los países endeudados en dólares y presiona a la baja el precio de sus bonos. Para la Argentina la relación es directa: una suba del UST10Y castiga a los soberanos en dólares aunque el riesgo país no se mueva, porque la tasa de descuento de los flujos subió.",
      example:
        "Un GD35 que rinde 11% cuando el UST10Y está en 4,2% tiene 680 pb de spread. Si el Treasury sube a 4,7% y el spread se mantiene, el bono pasa a rendir 11,5% y su precio cae: el inversor argentino perdió por una decisión tomada en Washington, no en Buenos Aires.",
    },
  },
  {
    ticker: "DXY",
    term: "DXY",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Índice del dólar estadounidense contra una canasta de seis monedas desarrolladas.",
      detail:
        "Mide la fuerza del dólar frente al euro —que pesa más de la mitad de la canasta—, el yen, la libra, el dólar canadiense, la corona sueca y el franco suizo. Cuando el DXY sube, el dólar se aprecia globalmente y las monedas y materias primas de los emergentes tienden a sufrir: las commodities cotizan en dólares, así que un dólar más fuerte las abarata en esa moneda y le pega a los términos de intercambio de un país exportador como la Argentina. Es el indicador que explica movimientos locales que no tienen causa local.",
      example:
        "Si el DXY sube 3% en un mes y la soja cae 5% en el mismo período, buena parte de esa caída no es un problema de oferta y demanda de soja sino de fortaleza del dólar. El efecto local llega después: menos dólares por la misma cosecha.",
    },
  },
  {
    ticker: "BRL",
    term: "Real brasileño (BRL)",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Tipo de cambio del real contra el dólar: la moneda del principal socio comercial de la Argentina.",
      detail:
        "Brasil es el mayor destino de las exportaciones industriales argentinas, así que el cruce entre ambas monedas define competitividad de manera muy concreta. Lo que importa no es el peso contra el dólar aislado, sino el tipo de cambio bilateral: si el real se devalúa contra el dólar y el peso no lo acompaña, los productos argentinos se encarecen en góndola brasileña y los brasileños se abaratan acá. Un salto del dólar en Brasil suele anticipar presión sobre el tipo de cambio real argentino aunque en el mercado local no haya pasado nada.",
      example:
        "Real de 5,00 a 5,50 por dólar (10% de devaluación) con el peso quieto: la Argentina se encareció 10% medida en reales. Un auto exportado a Brasil pasa a costarle al comprador brasileño 10% más sin que el fabricante haya tocado su precio de lista.",
    },
  },

  // ── Commodities ───────────────────────────────────────────────────────────
  {
    ticker: "ORO",
    term: "Oro",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Precio de la onza troy de oro en dólares: activo de refugio y cobertura contra la pérdida de valor del dinero.",
      detail:
        "No paga cupón ni dividendo, así que su costo de oportunidad es la tasa real en dólares: cuando la tasa real sube, tener oro cuesta más caro y su precio tiende a sufrir; cuando cae —o cuando aparece desconfianza sobre las monedas o los bancos centrales—, sube. Se lo mira como termómetro de miedo y como cobertura de largo plazo, y es una de las tenencias que los bancos centrales usan para diversificar reservas. En una cartera cumple el rol de descorrelacionar: suele moverse distinto de las acciones justo cuando más falta hace.",
      example:
        "Con la onza en USD 3.400, un cliente que quiere 5% de su cartera de USD 200.000 en oro necesita unas 2,9 onzas equivalentes. En el mercado local se accede vía CEDEARs de ETFs de oro o mineras, con el spread y el riesgo de contraparte que eso agrega.",
    },
  },
  {
    ticker: "PETROLEO",
    term: "Petróleo Brent",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Precio del crudo Brent, referencia internacional del petróleo, en dólares por barril.",
      detail:
        "Es el benchmark del crudo del Atlántico y la referencia con la que se comparan el resto de las calidades. Para la Argentina dejó de ser sólo un costo: con Vaca Muerta en producción, el precio del barril define la rentabilidad del no convencional, el atractivo de las inversiones en el sector y buena parte del resultado de YPF y de las energéticas que cotizan. También entra por el lado de los precios internos —combustibles y tarifas— y por el de las exportaciones, que hoy son una fuente creciente de dólares genuinos.",
      example:
        "Brent de USD 80 a USD 65 el barril: una caída del 19% que reduce el margen de los proyectos no convencionales y suele arrastrar a las acciones energéticas argentinas más que al índice, porque su resultado depende casi linealmente de ese precio.",
    },
  },
  {
    ticker: "SOJA",
    term: "Soja (Chicago)",
    seed: {
      category: "General",
      term_type: "metrica",
      short_def: "Precio del poroto de soja en el mercado de Chicago, referencia mundial del complejo sojero.",
      detail:
        "El precio de Chicago es el que se traslada, con descuentos y retenciones, a lo que cobra el productor argentino. Importa por el canal de los dólares: la soja y sus derivados son el principal complejo exportador del país, así que el precio internacional multiplicado por la cosecha define cuántos dólares entran por el MULC y, con eso, cuánta munición tiene el BCRA para sostener el tipo de cambio y acumular reservas. Una sequía o una caída fuerte del precio se sienten en las reservas mucho antes que en el PBI.",
      example:
        "Una cosecha de 50 millones de toneladas a USD 380 la tonelada son USD 19.000M de valor bruto; a USD 320, USD 16.000M. Esos USD 3.000M de diferencia son, aproximadamente, la capacidad de intervención cambiaria que el Central tiene o no tiene ese año.",
    },
  },

  // ── Acciones ──────────────────────────────────────────────────────────────
  {
    ticker: "MERVAL",
    term: "Merval",
    seed: {
      category: "Renta Variable",
      term_type: "metrica",
      short_def: "Índice del panel líder de BYMA: las acciones argentinas más negociadas, medido en pesos.",
      detail:
        "Reúne a las empresas de mayor volumen y participación en el mercado local, con una cartera que se recompone trimestralmente según la liquidez de cada papel. Al estar medido en pesos, sube naturalmente con la inflación y con el tipo de cambio: un Merval que sube 40% en un año con 40% de inflación no creó valor. Por eso la lectura seria del índice se hace en dólares, dividiéndolo por el CCL, y por eso conviene mirar también qué pesa adentro: bancos y energéticas dominan, así que el índice cuenta sobre todo la historia de esos dos sectores.",
      example:
        "Merval de 2.000.000 a 2.400.000 puntos (+20%) mientras el CCL pasa de $1.500 a $1.560 (+4%): en dólares el índice pasó de 1.333 a 1.538 puntos, una suba real del 15%. Ese 15% es el número que importa.",
    },
  },
  {
    ticker: "MERVAL_USD",
    term: "Merval en dólares",
    seed: {
      category: "Renta Variable",
      term_type: "metrica",
      short_def: "El índice Merval dividido por el CCL: la evolución de las acciones argentinas en moneda dura.",
      detail:
        "Es la única forma de comparar el mercado local consigo mismo a través del tiempo y con otros mercados, porque neutraliza la inflación y la devaluación. Sirve además como medida de valuación agregada del equity argentino: históricamente se movió en un rango amplio entre pisos de crisis y máximos de euforia, y ubicarse en ese rango dice más sobre el momento del mercado que cualquier P/E individual. Como se calcula contra el CCL, un salto del dólar financiero puede hundir el índice en dólares sin que ninguna empresa haya cambiado.",
      example:
        "Merval en 2.400.000 puntos con CCL a $1.574: el índice en dólares es 2.400.000/1.574 = 1.525 puntos. Si el CCL salta a $1.700 y el índice en pesos no se mueve, el Merval en dólares cae a 1.412: 7,4% menos sin que haya pasado nada con los balances.",
    },
  },

  // ── Soberanos en dólares ──────────────────────────────────────────────────
  {
    ticker: "AL29",
    term: "AL29",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Bonar 2029: el más corto de los soberanos en dólares bajo ley argentina del canje 2020.",
      detail:
        "Como todos los bonos del canje 2020, paga cupones semestrales crecientes (step-up) y devuelve el capital en cuotas, no de una sola vez al vencimiento. Al ser el más corto de la curva bajo ley local, su duration es baja: se mueve menos que el resto ante cambios de tasa o de riesgo país, y su precio depende sobre todo de la percepción de que los próximos vencimientos se van a pagar. Es el tramo que primero refleja una mejora concreta de la capacidad de pago y el que menos sube cuando lo que se compra es una expectativa de largo plazo.",
      example:
        "Frente a una compresión de 200 pb de riesgo país, un AL29 con duration 2,5 sube alrededor de 5%, mientras un AL35 con duration 5 sube cerca del 10%. Quien cree en la mejora pero quiere dormir tranquilo se queda en el corto; quien quiere apalancarse a esa mejora se va al largo.",
    },
  },
  {
    ticker: "AL30",
    term: "AL30",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Bonar 2030: el soberano en dólares ley argentina con más volumen, caballito de batalla del MEP y el CCL.",
      detail:
        "Su liquidez es la razón por la que se volvió el instrumento estándar para dolarizarse: se compra con pesos en BYMA y se vende la misma especie en dólares, y el cociente entre ambos precios es el tipo de cambio implícito. Esa masa de operaciones cambiarias hace que su precio cargue, además del riesgo de crédito, la presión de la demanda de dólares del día: cuando mucha gente quiere dolarizarse, el AL30 en pesos sube y el AL30 en dólares baja. Comparado con el GD30 —mismo perfil de flujos pero bajo ley de Nueva York— la diferencia de rendimiento entre ambos es la medida más limpia de cuánto cobra el mercado por la jurisdicción local.",
      example:
        "AL30 a $73.000 por cada 100 nominales y a USD 46,5 en su especie en dólares: el MEP implícito es 73.000/46,5 = $1.570. Si el GD30 rinde 10,5% y el AL30 11,4%, esos 90 pb son el precio de la ley argentina.",
    },
  },
  {
    ticker: "AL35",
    term: "AL35",
  },
  {
    ticker: "AE38",
    term: "AE38",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Bonar 2038: soberano en dólares ley argentina, con la estructura de cupones del tramo largo del canje.",
      detail:
        "Es el par local del Global 2038: mismo perfil de flujos, distinta jurisdicción. Está en el tramo largo de la curva, con cupones más altos que los bonos cortos y amortización lejana, así que su precio es sensible tanto al riesgo país como a la tasa internacional. Se lo suele comparar contra el GD38 para leer el spread por legislación en el tramo largo, que tiende a ser mayor que en el corto: cuanto más lejos está el pago, más pesa la pregunta de en qué tribunal se reclama si algo sale mal.",
      example:
        "Si el AE38 rinde 12,3% y el GD38 11,4%, el spread por ley es de 90 pb. Un cliente que confía en la normalización y no le da valor a la jurisdicción extranjera captura ese diferencial quedándose en el bono local; el que quiere protección legal paga esos 90 pb como prima de seguro.",
    },
  },
  {
    ticker: "AL41",
    term: "AL41",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Bonar 2041: el vencimiento más largo entre los soberanos en dólares bajo ley argentina.",
      detail:
        "Al ser el más largo de su curva es también el más volátil: concentra la mayor duration y por lo tanto la mayor sensibilidad a cualquier cambio en el rendimiento exigido. Comprarlo es una apuesta direccional a que el riesgo país comprime de manera sostenida en el tiempo, no a que se cobra el próximo cupón. Su contracara es que, si la normalización se demora, la pérdida de valor es igual de amplificada; y como buena parte del capital se devuelve muy lejos en el tiempo, la paridad puede quedar baja durante años sin que eso signifique nada sobre los pagos inmediatos.",
      example:
        "Con duration cercana a 7, una compresión de 300 pb de riesgo país implica una suba de precio del orden del 21%; una ampliación de 300 pb, una caída similar. Es el instrumento con el que se toma la posición más agresiva sobre el crédito argentino sin salir de renta fija.",
    },
  },
  {
    ticker: "GD29",
    term: "GD29",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Global 2029: el más corto de los soberanos en dólares bajo ley de Nueva York.",
      detail:
        "Comparte estructura con el AL29 —cupones step-up y amortización en cuotas— pero se rige por tribunales de Nueva York, lo que le da al tenedor una posición más fuerte frente a un eventual reperfilamiento. Al ser corto y con jurisdicción extranjera, es el bono más defensivo de la curva soberana: el que elige un inversor que quiere exposición a la mejora del crédito argentino con el menor riesgo posible de precio y de jurisdicción. Su rendimiento suele ser el más bajo del conjunto, y esa es exactamente la contrapartida de su seguridad relativa.",
      example:
        "En una cartera conservadora en dólares, GD29 cumple el rol del tramo corto: si el escenario se deteriora, cae bastante menos que un GD41, y mientras tanto los pagos de cupón y amortización que ya están cerca sostienen el precio.",
    },
  },
  {
    ticker: "GD30",
    term: "GD30",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Global 2030: el soberano ley Nueva York más operado, referencia para el contado con liquidación.",
      detail:
        "Es el espejo del AL30 bajo ley extranjera y el instrumento habitual para el CCL, porque además de operar en BYMA cotiza en el exterior: comprarlo en pesos acá y venderlo afuera es la operación que forma el tipo de cambio de cable. Al tener el mismo cronograma de pagos que el AL30 y distinta jurisdicción, el par AL30/GD30 es la referencia estándar del mercado para medir el spread por legislación, y su volumen hace que ese spread sea confiable en vez de un artefacto de baja liquidez.",
      example:
        "GD30 a $75.500 en BYMA y a USD 48 en Nueva York: el CCL implícito es 75.500/48 = $1.573. Si ese número se despega del CCL calculado con otros bonos, la diferencia suele durar poco: el arbitraje entre especies la cierra.",
    },
  },
  {
    ticker: "GD35",
    term: "GD35",
  },
  {
    ticker: "GD38",
    term: "GD38",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Global 2038: soberano ley Nueva York que conserva el indenture 2005, con cláusulas más exigentes para el emisor.",
      detail:
        "Junto con el GD41 es uno de los bonos que mantiene el contrato de emisión de 2005, cuyas cláusulas de acción colectiva le imponen al país mayorías más difíciles de reunir para imponer una reestructuración a los acreedores que no la acepten. Esa protección legal extra explica por qué suele rendir menos que otros bonos de plazo parecido: el mercado paga por la mejor posición negociadora. Para el tenedor, la diferencia sólo se vuelve concreta en un escenario de reestructuración, que es justamente cuando importa.",
      example:
        "Si el GD38 rinde 11,4% y el GD41 y el GD46 rinden más, la diferencia no es sólo plazo: parte del premio del resto de la curva es el indenture más débil. Comparar GD38 contra GD35 —plazos similares, contratos distintos— aísla cuánto vale esa protección.",
    },
  },
  {
    ticker: "GD41",
    term: "GD41",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Global 2041: el bono largo bajo ley Nueva York que conserva las cláusulas del indenture 2005.",
      detail:
        "Combina las dos características que buscan los tenedores institucionales: plazo largo, que maximiza la ganancia si el riesgo país comprime, y el contrato de emisión de 2005, que es el más protectivo de la curva. Por eso es el favorito de los fondos del exterior que quieren exposición al crédito argentino sin resignar posición legal, y suele mostrar mejor comportamiento relativo que otros bonos largos en los momentos de estrés. La contracara es la de todo bono largo: alta duration, movimientos de precio amplios en ambas direcciones.",
      example:
        "En una corrección donde el riesgo país se amplía 200 pb, un GD41 cae menos que un GD46 de duration parecida, y esa diferencia se atribuye normalmente a la calidad del contrato. Cuando el mercado se calma, ese diferencial se achica.",
    },
  },
  {
    ticker: "GD46",
    term: "GD46",
    seed: {
      category: "Instrumentos AR",
      term_type: "instrumento",
      short_def: "Global 2046: el vencimiento más lejano de la curva soberana en dólares, ley Nueva York.",
      detail:
        "Es el bono de mayor duration del universo soberano argentino y, por lo tanto, el más apalancado a una compresión de riesgo país: quien lo compra está comprando la historia completa de normalización, con pagos que se extienden más de dos décadas. Suele cotizar con las paridades más bajas de la curva, lo que lo vuelve atractivo para el que mira precio absoluto, pero esa misma característica lo convierte en el más castigado cuando el escenario se da vuelta. Se rige por el indenture 2016, así que no tiene la protección contractual extra del GD38 y el GD41.",
      example:
        "Un GD46 a paridad 45 tiene mucho más recorrido teórico que un GD29 a paridad 90, pero también necesita que la Argentina siga pagando durante veinte años para que esa paridad converja. La pregunta a responder antes de comprarlo no es de precio, es de horizonte.",
    },
  },
];

/** ticker del panel → término del glosario. */
export const TERMINO_POR_TICKER: Record<string, string> = Object.fromEntries(
  DEFINICIONES_INSTRUMENTOS.map((d) => [d.ticker, d.term])
);

/** Lo que el panel necesita mostrar de un término, resuelto contra la DB. */
export interface InstrumentoDef {
  term: string;
  short: string;
  categoria: string;
}

/** URL del glosario abierto en un término. */
export function hrefGlosario(term: string): string {
  return `/glossary?term=${encodeURIComponent(term)}`;
}
