/**
 * Los términos de la Fed y de la macro norteamericana, para el glosario.
 *
 * Van en su propio módulo y no en `glosario-instrumentos.ts` porque no son
 * instrumentos del panel: son los conceptos que aparecen en `/eeuu` y que hay
 * que poder explicarle a un cliente sin googlear —qué es el FOMC, qué es el dot
 * plot, por qué la meta está definida sobre el PCE y no sobre el IPC—.
 *
 * Se insertan sólo los que faltan (ver `seedGlosarioFed` en `db.ts`): la
 * edición manual desde la UI manda sobre esta lista.
 */
import type { GlossaryCategory, TermType } from "@/lib/glossary";

export interface TerminoGlosario {
  term: string;
  category: GlossaryCategory;
  term_type: TermType;
  short_def: string;
  detail: string;
  example: string;
}

export const TERMINOS_FED: TerminoGlosario[] = [
  {
    term: "FOMC",
    category: "Tasas & Curvas",
    term_type: "concepto",
    short_def: "El comité de la Reserva Federal que decide la tasa de política monetaria de EE.UU.",
    detail:
      "El Federal Open Market Committee lo integran los siete miembros del Board of Governors más cinco presidentes de bancos regionales de la Reserva Federal —el de Nueva York siempre, los otros cuatro por rotación—. Se reúne ocho veces al año durante dos días y anuncia la decisión el segundo día a las 14:00 de Nueva York, seguida de una conferencia de prensa del presidente de la Fed. Las actas de cada reunión se publican tres semanas después y suelen mover el mercado por su cuenta, porque muestran cuán dividido estaba el comité. El calendario se publica con dos años de anticipación, así que las fechas nunca son una sorpresa: lo que se descuenta es la decisión, no el día.",
    example:
      "Si el mercado tiene descontados 15 pb para una reunión y el FOMC sube 25, la diferencia no descontada es la que mueve el precio de los bonos ese mismo día. Cuando la decisión sale exactamente como estaba en los futuros, lo que mueve al mercado es el comunicado o la conferencia, no la tasa.",
  },
  {
    term: "Dot plot",
    category: "Tasas & Curvas",
    term_type: "concepto",
    short_def: "El gráfico donde cada miembro del FOMC marca dónde ve la tasa a fin de cada año y en el largo plazo.",
    detail:
      "Forma parte del Summary of Economic Projections, que se publica en cuatro de las ocho reuniones anuales (marzo, junio, septiembre y diciembre). Cada punto es un miembro del comité, anónimo, y lo que se mira es la **mediana**: es la señal de hacia dónde cree el propio comité que va la tasa. Suele mover más al mercado que la decisión en sí, porque la decisión ya venía descontada y el dot plot es información nueva sobre el sendero. Dos advertencias que conviene decir en voz alta: no es un compromiso —el comité cambia de opinión con los datos— y el punto de largo plazo es la estimación implícita de la tasa neutral, que es de las cosas más discutidas de la macro.",
    example:
      "El mercado descuenta dos subas para el año próximo y la mediana del dot plot muestra cuatro: la curva del Tesoro se corrige hacia arriba en cuestión de minutos, aunque la tasa de hoy no se haya movido.",
  },
  {
    term: "PCE núcleo",
    category: "General",
    term_type: "metrica",
    short_def: "El índice de precios sobre el que está definida la meta del 2% de la Reserva Federal.",
    detail:
      "El Personal Consumption Expenditures price index lo publica el Bureau of Economic Analysis y se diferencia del IPC en tres cosas: cubre una canasta más amplia (incluye lo que pagan por el consumidor terceros, como la salud cubierta por seguros), actualiza las ponderaciones a medida que la gente sustituye productos, y pesa distinto la vivienda. Por eso suele correr algunas décimas por debajo del IPC. La versión núcleo excluye alimentos y energía. Es **el** número que la Fed mira para juzgar si cumplió su mandato de precios, y sale alrededor de un mes más tarde que el IPC, así que el IPC funciona como su anticipo.",
    example:
      "IPC general en 3,3% y PCE núcleo en 3,3%: con la tasa efectiva en 3,63%, la tasa real de política es de apenas 0,3 puntos. Es la cuenta que define si la Fed está apretando o no, y se hace con este índice, no con el IPC.",
  },
  {
    term: "Breakeven de inflación",
    category: "Tasas & Curvas",
    term_type: "metrica",
    short_def: "La inflación que descuenta el mercado, leída de la diferencia entre un bono nominal y uno ajustable.",
    detail:
      "Es la diferencia entre el rendimiento de un Treasury nominal y el de un TIPS —el bono del Tesoro que ajusta capital por el IPC— del mismo plazo. Si el nominal a 10 años rinde 4,6% y el TIPS a 10 años rinde 2,3%, el mercado está descontando 2,3% de inflación promedio para la década: a esa inflación, los dos bonos rinden lo mismo. A diferencia del IPC, que es un dato del pasado, esto es una expectativa con dinero real detrás. La variante más mirada es la forward 5 años dentro de 5 años, que saltea el ruido de corto plazo y muestra si las expectativas de largo siguen ancladas en la meta. Cuando ese número se despega del 2%, la Fed se pone nerviosa aunque el dato del mes venga bien.",
    example:
      "Breakeven a 10 años en 2,31% y forward 5a5a en 2,32%: el mercado le cree a la Fed en el largo plazo. Si el forward se fuera a 2,8%, sería una señal de desanclaje y justificaría una política más dura aunque el dato mensual estuviera bajando.",
  },
  {
    term: "Curva invertida",
    category: "Tasas & Curvas",
    term_type: "concepto",
    short_def: "Cuando las tasas cortas rinden más que las largas: la señal clásica de recesión.",
    detail:
      "Lo normal es que un bono a diez años rinda más que uno a tres meses, porque prestar por más tiempo tiene más riesgo. Cuando se invierte, el mercado está diciendo que la política monetaria de hoy es tan restrictiva que va a tener que aflojar: espera recortes, y esos recortes ya están en el precio de la parte larga. Las dos versiones que se miran son 10 años menos 2 años y 10 años menos 3 meses; la segunda tiene mejor historial anticipando recesiones en EE.UU. desde 1970. La advertencia importante es el rezago: entre la inversión y la recesión suelen pasar de doce a veinticuatro meses, y la curva a veces se desinvierte justo antes de que la recesión empiece, así que como señal de *timing* no sirve.",
    example:
      "Con el 10 años en 4,67%, el 2 años en 4,20% y el 3 meses en 3,84%, las dos pendientes son positivas (+39 y +83 pb): la curva no está invitando a pensar en recesión.",
  },
  {
    term: "Futuros de fondos federales",
    category: "Derivados",
    term_type: "instrumento",
    short_def: "El contrato del que se lee, sin opinar, qué tasa espera el mercado para cada reunión de la Fed.",
    detail:
      "Cotizan en el CME con el código ZQ y liquidan contra el **promedio diario de la tasa efectiva de fondos federales del mes del contrato**. Su tasa implícita es 100 menos el precio: un ZQ de diciembre a 96,035 implica 3,965% promedio para diciembre. Como el promedio de un mes con reunión mezcla la tasa vieja y la nueva en proporción a los días de cada una, del conjunto de contratos se puede despejar qué tasa espera el mercado después de cada reunión, y de ahí la probabilidad implícita de un movimiento de 25 puntos básicos. Es la cuenta que publica el FedWatch de CME. Dos límites honestos: supone un único movimiento de 25 pb por reunión, y el precio del futuro incluye una prima de riesgo chica que nadie descuenta.",
    example:
      "Tasa efectiva en 3,63% y el contrato del mes de la reunión implicando 3,77% después de ella: son 14 pb descontados, o sea que el mercado le asigna un 57% a una suba de 25 pb y un 43% a que no pase nada.",
  },
  {
    term: "Mandato dual",
    category: "General",
    term_type: "concepto",
    short_def: "Los dos objetivos que el Congreso le fijó por ley a la Reserva Federal: precios estables y máximo empleo.",
    detail:
      "A diferencia del Banco Central Europeo, que sólo tiene mandato de inflación, la Fed tiene que perseguir dos cosas a la vez, y buena parte de la interpretación de sus decisiones consiste en leer cuál de las dos está pesando más en cada momento. Cuando los dos objetivos apuntan en la misma dirección —inflación alta y empleo fuerte— la decisión es fácil. El problema es cuando divergen: inflación arriba de la meta y empleo debilitándose obliga a elegir, y esa elección es la que el comunicado y la conferencia de prensa dejan entrever. Por eso los datos de empleo mueven la tasa tanto como los de precios.",
    example:
      "Inflación núcleo en 3,3% —arriba de la meta— con nóminas negativas y desempleo en 4,1%. Los dos lados del mandato piden cosas opuestas: es exactamente la situación en la que el comité se divide y las actas de la reunión importan más que la decisión.",
  },
  {
    term: "Nóminas no agrícolas",
    category: "General",
    term_type: "metrica",
    short_def: "Los puestos de trabajo que la economía de EE.UU. creó o destruyó en el mes. El dato que más mueve al mercado.",
    detail:
      "Lo publica el Bureau of Labor Statistics el primer viernes de cada mes a las 8:30 de Nueva York, junto con la tasa de desempleo y los salarios. Excluye al sector agropecuario porque su empleo es fuertemente estacional y ensuciaría la serie. Se mira el cambio respecto del mes anterior —\"la economía creó 150 mil puestos\"— y también las revisiones de los dos meses previos, que a veces son más grandes que el dato nuevo. Es el número que con más frecuencia mueve la curva del Tesoro en el momento en que sale, porque toca directamente el lado del empleo del mandato dual.",
    example:
      "Nóminas en -23 mil con desempleo en 4,1%: la creación de empleo se dio vuelta. Si se sostiene, adelanta recortes de tasa aunque la inflación siga arriba de la meta, y eso se ve primero en el tramo corto de la curva.",
  },
  {
    term: "Spread high yield",
    category: "Renta Fija",
    term_type: "metrica",
    short_def: "La prima que paga el crédito corporativo de baja calificación sobre el Tesoro. El termómetro del apetito por riesgo.",
    detail:
      "Es la diferencia de rendimiento entre un índice de bonos corporativos norteamericanos por debajo de grado de inversión y la curva del Tesoro. Se lo mira menos por lo que dice del crédito corporativo que por lo que dice del humor del mercado: cuando se abre, los inversores están pidiendo más compensación por cualquier riesgo, y eso llega a los emergentes antes que a ninguna otra clase de activo. Para un asesor argentino es un indicador adelantado del riesgo país: los Globales suelen moverse acompañando este spread aun cuando no haya ninguna noticia local.",
    example:
      "Spread high yield en 263 pb —niveles de calma— y riesgo país argentino en 510. Si el high yield se abre a 450 en un episodio de estrés global, el riesgo país acompaña y los Globales caen sin que haya pasado nada en la Argentina.",
  },
  {
    term: "Quantitative tightening",
    category: "General",
    term_type: "concepto",
    short_def: "La reducción del balance de la Reserva Federal: retirar liquidez sin tocar la tasa.",
    detail:
      "Después de años de comprar bonos para inyectar dinero (quantitative easing), la Fed reduce su tenencia dejando vencer los títulos sin reinvertir el capital. El efecto es contractivo aunque la tasa de política no se mueva: hay menos dinero circulando y el sistema tiene que absorber la oferta de bonos que antes compraba el Central. Es una segunda palanca, más lenta y menos visible que la tasa, y por eso conviene mirar el tamaño del balance junto con el nivel de la tasa: dos momentos con la misma tasa pero uno con el balance creciendo y otro con el balance cayendo no son la misma política monetaria.",
    example:
      "Balance en USD 6,73 billones y cayendo unos USD 15 mil millones por semana: eso drena liquidez del sistema todas las semanas, aunque el rango objetivo quede exactamente donde está.",
  },
  {
    term: "SOFR",
    category: "Tasas & Curvas",
    term_type: "metrica",
    short_def: "Secured Overnight Financing Rate: la tasa colateralizada a un día que reemplazó a la LIBOR.",
    detail:
      "Refleja el costo de tomar prestado dólares por una noche contra bonos del Tesoro como garantía, y se calcula sobre transacciones reales del mercado de repos —a diferencia de la LIBOR, que se armaba con estimaciones declaradas por un panel de bancos y terminó en un escándalo de manipulación—. Como está colateralizada, casi no tiene riesgo de crédito, y por eso corre muy cerca de la tasa efectiva de fondos federales. Es la referencia para la deuda a tasa flotante en dólares, incluidos varios préstamos sindicados que toman empresas argentinas.",
    example:
      "SOFR en 3,64% con la tasa efectiva de fondos federales en 3,63%: prácticamente pegadas. Cuando se separan por varios puntos básicos suele ser señal de tensión de liquidez en el mercado de repos, y la Fed lo toma como un problema a atender.",
  },
];
