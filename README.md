This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Macro Argentina y las provincias

`/mercado` es el panel macro: dólar, tasas en pesos, inflación, riesgo y
reservas, global, commodities y acciones. Abajo suma quién gobierna —Ejecutivo
nacional y el reparto de las 24 jurisdicciones por población— y un **mapa
interactivo** de las provincias.

El mapa se colorea por empleo privado, exportaciones, población u orientación
del gobierno provincial. Al elegir una provincia muestra gobernador, partido,
bloque, población, empleo y exportaciones, más el ranking de las que más crecen
y las que más caen.

### De dónde salen los datos provinciales

| Dato | Fuente | Frecuencia |
|---|---|---|
| Geometría de las 24 | Natural Earth (dominio público), simplificada y proyectada a SVG en `scripts/generar-provincias.mjs` | fija |
| Gobernador, partido, orientación | Escrito a mano en el generador, mandatos 2023-2027 | se corre a mano al cambiar |
| Foto del gobernador | Wikipedia en español (`prop=pageimages`), imágenes de Wikimedia Commons | al regenerar |
| **Composición de exportaciones** | INDEC, desglose por rubro (primarios, agro, industria, energía) | anual |
| **Destinos de exportación** | INDEC, por país | anual |
| Población | Censo Nacional 2022 (INDEC) | fija |
| **Empleo privado registrado** | SSPM vía CSV de datos.gob.ar | mensual |
| **Exportaciones** | INDEC vía la API de series de datos.gob.ar | anual |

**Lo que no se muestra, y por qué:** producto bruto geográfico y empleo público
por provincia. Argentina no los publica de forma regular ni comparable entre
jurisdicciones, y no están en ninguna API del Estado. Estimarlos sería
inventarlos, así que la ficha lo dice en vez de rellenar el hueco.

> Dos trampas de la API de series, ya resueltas en el código: el parámetro
> `dataset_title` **no filtra nada** —devuelve cualquier cosa, incluidas
> estadísticas criminales—, hay que buscar por texto; y los IDs de serie no
> siguen un patrón deducible (`350.1_JUJUY_TOTAJUY__17`), así que se emparejan
> por descripción.

**Los logos partidarios no se traen.** Son marcas registradas y en Wikipedia
están bajo uso legítimo, que no habilita reutilizarlos en otro sitio. En su
lugar va el nombre del partido en una etiqueta. Las fotos sí: son de Wikimedia
Commons con licencia libre.

> La búsqueda de fotos va contra la Wikipedia en español y no contra Wikidata:
> esa API corta las consultas anónimas y cada corrida resolvía un subconjunto
> distinto. Igual el generador acumula —arranca de lo ya guardado y sólo
> agrega—, así una corrida con la red mal nunca borra lo que ya estaba.
>
> **Cada candidato se valida antes de aceptarlo**, porque pedir la imagen por el
> nombre y quedarse con lo que venga trajo tres fotos equivocadas: el abuelo del
> gobernador de Entre Ríos —homónimo exacto—, el mapa de la elección del Chaco y
> después su Casa de Gobierno. Ahora el apellido tiene que estar en el título de
> la página, la persona no puede figurar como fallecida, y el artículo tiene que
> hablar de esa provincia. Leandro Zdero no tiene foto en Wikipedia: la ficha
> muestra sus iniciales, que es mejor que mostrar un edificio.

> **Trampa de los rubros del INDEC:** las manufacturas de origen industrial
> incluyen *piedras y metales preciosos*, así que San Juan aparece con 87% en
> "industria" cuando en realidad exporta oro. El destino lo delata: su primer
> comprador es Suiza, que refina. La ficha lo advierte cuando se da ese patrón.
> Otra: la soja sale del país sobre todo como harina y aceite, no como grano, y
> eso cae en manufacturas agropecuarias — por eso Santa Fe tiene 80% MOA.

La descripción de cada provincia se arma **con los datos**, no con textos fijos:
cuánto pesa en población, empleo y exportaciones, de qué rubro salen sus
dólares, y si el empleo crece, está estancado o cae. Así no queda vieja ni dice
nada que el dato no respalde.

El generador valida antes de escribir: si un gobernador aparece en dos
provincias, aborta. Ese control apareció después de cargar a Weretilneck en Río
Negro **y** en La Rioja.

---

## Renta fija

`/renta-fija` muestra la **curva de rendimientos** de los soberanos
hard-dollar: TIR contra duration, con una serie por ley. La distancia entre las
dos curvas es lo que el mercado cobra por litigar en Nueva York en vez de en
Buenos Aires. La tabla de precios queda plegada abajo, para el detalle.

### La TIR se calcula, no se trae

Ninguna fuente pública argentina publica el rendimiento de estos bonos — se
verificaron data912, argentinadatos, Bolsar, BYMA, IAMC y Yahoo. Así que
`src/lib/bonos.ts` lo calcula, con la convención del mercado:

| | Qué usa | Por qué |
|---|---|---|
| Método | **Bisección** sobre la ecuación de valor presente | La TIR es la raíz de una ecuación escalar no lineal. Newton-Raphson converge más rápido pero puede divergir con flujos irregulares |
| Capitalización | **Semestral** (bond-equivalent yield) | Es la convención de estos bonos. Capitalizar anual daba una TIR 17 pb más alta |
| Base de días | **30/360** | La de estos bonos |
| Duration | **Modificada**, dividiendo por (1 + TIR/2) | Con capitalización semestral hay que dividir por uno más la tasa del período |

> **Gauss-Seidel no aplica acá.** Resuelve sistemas de ecuaciones lineales
> (Ax = b); la TIR de un bono es la raíz de una ecuación escalar no lineal.

### Los cronogramas

Los flujos de fondos salen de la API de configuración de **rendimientos.co** y
se generan con:

```bash
node scripts/generar-flujos-bonos.mjs
```

Quedan en `src/lib/bonos-flujos.ts` — 15 soberanos y 51 ONs. Se guardan en el
repo porque un cronograma de amortización no cambia: así el dashboard no depende
de que ese sitio esté arriba ni le pega un request por visita. Los precios sí se
piden en vivo a data912, que es la fuente que ya usaba el panel.

Antes estos cronogramas estaban escritos a mano desde los prospectos, y estaban
mal: los 2029 y 2030 quedaban fuera de la curva que formaban los demás (AL29
daba 17% contra un riesgo país que implicaba 9,8%). Con los datos reales, la
validación no marca ningún sospechoso.

> **Trampa de escala, ya resuelta en el generador:** la fuente publica los
> soberanos por cada 100 de valor nominal y las ONs por cada 1. Los precios de
> las dos vienen en base 100, así que sin normalizar el valor presente de una ON
> daba ~1 contra un precio de ~101 y la bisección devolvía null para las 51. El
> generador detecta la escala por la suma de los flujos y aborta si algo queda
> fuera de rango.

### Lo que muestra la página

- **Curva de soberanos** — TIR contra duration, una serie por ley. La distancia
  entre las dos es lo que se paga por litigar en Nueva York.
- **Obligaciones negociables** — la nube de 45 corporativas en dólares, con la
  curva soberana ley NY encima como referencia. Que una ON rinda *por debajo*
  del soberano es habitual en Argentina: el Estado tiene historial de default y
  las buenas empresas no.
- La tabla de precios queda plegada abajo, para el detalle.

Los bonos a menos de seis meses se dibujan en gris punteado: a esa altura un
peso de diferencia en el precio mueve la TIR anualizada varios puntos, y arriba
de la nube parecen una oportunidad cuando son ruido de liquidez.

---

## Equity — monitor de NYSE + Nasdaq

Tres pantallas:

- **`/equity`** — rankea ~2.100 empresas de NYSE y Nasdaq por cuánto se
  movieron. Franja con el S&P y los once sectores del día, composición de SPY,
  QQQ, DIA e IWM, retornos contra el índice (alpha), filtros guardados y
  agrupado por sector.
- **`/equity/<TICKER>`** — la ficha: gráfico de TradingView, fundamentals contra
  la mediana de sus pares, ventas y márgenes por año, resultados contra el
  consenso, analistas, noticias e investigación con fuentes.
- **`/etf`** — 53 fondos de referencia agrupados en ocho familias (amplios,
  sectoriales, países, regiones, renta fija, materias primas, estrategias y
  temáticos), con su descripción en castellano, el índice del mercado local,
  gestora, comisión anual, composición sectorial y mayores tenencias enlazadas.
  Las descripciones están escritas a mano en `ETFS` (`src/lib/equity.ts`) sobre
  el objetivo que declara cada prospecto: son 26 productos estables, no tiene
  sentido pagarle a un modelo por traducir lo mismo todos los días ni depender
  de una clave de API para leer qué es el SPY. La gestora sí es dato: sale de
  `fundProfile.family` de Yahoo.
- **`/equity/earnings`** — calendario de balances por semana. No cuesta ningún
  request extra: las fechas ya vienen en el lote que alimenta el ranking.

### Cómo se piden los datos

Todo sale de Yahoo Finance (`yahoo-finance2`) en dos etapas, separadas por costo:

| Etapa | Qué trae | Costo |
|---|---|---|
| `getTablero()` | Todo el universo con precio, variación del día, 12 meses, distancia a medias, PER, capitalización y fecha de earnings | ~11 requests |
| `conRetornos()` | Retornos exactos (1s/1m/3m/6m/YTD/12m) y sparkline | 1 request **por ticker** |

Por eso el ranking no calcula retornos exactos para las ~2.100: preselecciona
150 candidatos con las métricas baratas y sobre esos hace el cálculo fino. El
sesgo que introduce está documentado en `src/lib/equity.ts`.

> Como la tabla muestra 150 de 2.126, buscar un ticker que hoy no tiene momentum
> no encontraba nada. El buscador consulta además `/api/equity/buscar`, que
> recorre el universo entero y ofrece los que quedaron afuera como enlace
> directo a su ficha. Va por API y no en el cliente porque las 2.126 empresas
> pesan 44 KB y no tienen por qué viajar al navegador para tipear en un campo.

La composición de los índices sale de `topHoldings` de Yahoo, que da las **diez
mayores tenencias** de cada fondo, no la cartera completa. Bajarla entera
implicaría raspar a cada emisor —State Street publica un Excel, Invesco
directamente bloquea la descarga— con un formato distinto por casa.

> La torta sectorial muestra los **seis mayores sectores y agrupa el resto**.
> Once porciones con valores del 2% y 3% pegados no se leen, y harían falta once
> colores que ningún daltónico puede separar; la paleta de seis está validada
> contra el fondo del dashboard. Los once valores exactos van en la lista de al
> lado. Los fondos de bonos y materias primas (AGG, TLT, GLD) no tienen cartera
> de acciones: ahí el panel lo dice en vez de mostrarse vacío.

> **Ojo con las unidades de Yahoo:** algunos campos vienen en porcentaje
> (`regularMarketChangePercent`) y otros en fracción (`fiftyDayAverageChangePercent`,
> `profitMargins`, `dividendYield`), y `debtToEquity` ya viene en porcentaje.
> Está normalizado en `getTablero()` y `getFicha()`; si agregás un campo nuevo,
> verificá la unidad contra un cálculo a mano antes de mostrarlo.

No toca la base de datos: el caché es en memoria del proceso, con TTL (10 min el
tablero, 30 min las series, 1 hora las fichas). En Vercel la DB es efímera y
estos datos se rebajan solos, así que no hay nada que persistir.

### Las descripciones, en castellano y gratis

Yahoo publica las descripciones de empresa **sólo en inglés**, sin importar el
`lang` que se le pase — probado con `es-AR`, `es-ES` y `es-MX`. Se traducen en
`src/lib/traducir.ts` con MyMemory, que es gratis.

Antes esto pasaba por Claude. Traduce mejor, pero cuesta en cada pasada
(~US$0,005 por empresa) y obliga a tener una clave configurada. Para una
descripción de negocio la diferencia de calidad no justifica ninguna de las dos
cosas.

Dos límites del servicio, contemplados en el código:

| Límite | Cómo se maneja |
|---|---|
| 500 caracteres por pedido | Las descripciones promedian 1.550: se parten por oración y se rearman |
| Cuota diaria | ~5.000 caracteres sin registrar, 50.000 con un mail — unas 32 empresas por día. Al agotarse, la ficha vuelve al original en vez de romperse |

Para subir la cuota, registrar un mail en mymemory.translated.net y ponerlo en
`MYMEMORY_EMAIL`. Sin esa variable funciona igual, con el tope más bajo.

> Si un trozo falla, se descarta la traducción entera y se muestra el original:
> media descripción en castellano y media en inglés se lee peor que el original
> completo.

### Los datos provinciales están en el repo

Empleo privado y exportaciones por provincia se generan con:

```bash
node scripts/generar-datos-provincias.mjs
```

y quedan en `src/lib/provincias-datos.ts`. **En runtime no se pide nada por
red.**

Antes se pedían en cada render, y eso son **27 requests secuenciales** a las
APIs del Estado: el CSV del SSPM, dos catálogos y veintitrés lotes de series.
El caché vivía en memoria, así que cada arranque en frío los pagaba de nuevo.
Local eso son 2,4 segundos; desde una función en Vercel, con 200-400 ms de ida
y vuelta hasta Argentina, entre seis y once, con el mapa en blanco todo ese
tiempo.

No hace falta pagarlo: el empleo se publica una vez por mes y las exportaciones
una vez por año. Con el archivo generado, la página abre en 0,6 s en frío y
73 ms después, y el mapa sigue andando aunque datos.gob.ar esté caído.

> La fecha de generación y el período de cada serie se muestran al pie del
> mapa. Sin ese renglón, un dato que quedó viejo no se nota.

### Actualizar el universo

El universo vive en `src/lib/equity-universo.ts` y está generado:

```bash
node scripts/generar-universo.mjs
```

Baja el listado de NYSE y Nasdaq del screener de Nasdaq, **valida cada ticker
contra Yahoo** y escribe también `src/lib/equity-sectores.ts`. Ninguno de los
dos se edita a mano.

Lo que hace el filtro, y por qué:

| Regla | Motivo |
|---|---|
| Capitalización ≥ US$2.000M y precio ≥ US$5 | En crudo son ~6.900 papeles con SPACs, cáscaras y biotecs de dos dólares: el ranking de "lo que más se movió" devolvería ruido |
| Se descartan preferidas, notas y warrants | Tienen ticker propio y Nasdaq les asigna la capitalización de la empresa madre, así que pasan el filtro de tamaño. Un preferido a US$25 con cupón del 7% no es comparable con una acción |
| Los ADR argentinos entran siempre | El dashboard lo usa un asesor en Argentina; varios (SUPV, CRESY, EDN, LOMA, IRS, GLOB) quedan abajo del filtro de tamaño |
| Las del S&P 500 entran siempre | Nasdaq deja `marketCap` vacío en varias clases duales (BF/B), y CBOE ni figura porque cotiza en la bolsa propia de Cboe |
| Las tenencias de los ETF son una tercera fuente | El listado de Nasdaq tiene huecos: Electronic Arts (US$52.900M) y Moog (US$12.300M) cotizan pero no figuran ahí ni en el S&P. Aparecen dentro de un ETF, así que de ahí se rescatan |

> **No hay piso de precio.** El precio nominal de un ADR es arbitrario: depende
> de cuántas acciones locales representa cada uno. Ambev cotiza a US$2,88 y vale
> US$45.000M. La capitalización ya filtra la basura; un piso de precio sólo
> castigaba a los ADR extranjeros.

### El puente de tenencias

`src/lib/equity-tenencias.ts` mapea el símbolo con que un ETF reporta una
tenencia al ticker equivalente del dashboard: un fondo de Brasil compra
`VALE3.SA` en B3 y la misma empresa cotiza en NYSE como `VALE`. Sin el mapeo la
tenencia no enlaza a ninguna ficha.

Se resuelve contra el universo local, sin buscador externo, y el criterio es
deliberadamente estricto: se exige que **todas** las palabras del nombre más
corto estén en el otro, que alguna sea distintiva (no "holdings" ni "financial
group") y, si sólo coincide una palabra, que sea toda la identidad de ambos
lados. Con criterios más laxos aparecían enlaces peligrosos — "China
Construction Bank" caía en "Construction Partners", "Samsung Electronics" en
"Arrow Electronics" y "SK Square" en "Madison Square Garden". En un dashboard
financiero un link equivocado es peor que uno ausente, así que se pierde alguno
(Bradesco) antes que inventar uno.

Lo que no resuelve se muestra igual, diciendo en qué bolsa cotiza.

> El criterio para descartar preferidas es la mención al instrumento de renta
> fija, **no** la frase "Depositary Shares": los ADR comunes —Aeroméxico y todos
> los argentinos— también se describen así.

El sector es GICS. Para las empresas del S&P 500 sale del índice; para el resto
se traduce la taxonomía de Nasdaq, que es más gruesa y tiene errores (clasifica
a Agilent como *Industrials* cuando es *Health Care*). Los que no encajan en
ningún rubro caen en "Otros".

> Los sectores están en su propio archivo porque los usa la UI: si la lista de
> 500 empresas viviera ahí, se iría entera al bundle del navegador (son 44 KB).

---

## Deploy

Vercel **publica solo al pushear a `main`**. Verificado el 2026-08-24: un commit
llegó a dashboard-productividad-eight.vercel.app sin correr ningún comando de
deploy. (Este README decía lo contrario; estaba desactualizado.)

Lo que **no** viaja con el push son las variables de entorno. `ANTHROPIC_API_KEY`
se carga aparte y hasta que esté, la ficha muestra las descripciones en inglés y
oculta el panel de investigación:

```bash
vercel env add ANTHROPIC_API_KEY production
```
