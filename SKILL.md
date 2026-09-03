# Dashboard financiero — conocimiento operativo

Notas que se van acumulando sobre cómo trabajar en este proyecto: lo que
aprendo, lo que corrijo y las trampas que ya me comí. Bauty pidió mantener este
archivo al día con **cada cosa nueva que aprenda o mejore**.

## Qué es

Dashboard personal de un asesor financiero (Balanz). Sigue el mercado argentino
y global, fácil y rápido de leer. Next.js 16 + TypeScript + Tailwind v4 +
better-sqlite3 + Recharts + Anthropic SDK.

- Correr local: `npm run dev -- -p 3001` → http://localhost:3001
- `/` redirige a `/mercado`. Módulos: mercado, renta-fija, equity (con la
  **ficha de análisis** por empresa), etf, **eeuu**, **radar**, glossary,
  efemerides.

## Deploy (IMPORTANTE — corregido 27-ago-2026)

El push a `main` **deploya solo a Vercel** (integración git activa). **No** correr
`vercel deploy`: es innecesario y además el clasificador del harness lo bloquea.
Verificado: dos pushes seguidos → dos deploys de producción `Ready` sin tocar
nada (`vercel ls` los muestra). Producción:
https://dashboard-productividad-eight.vercel.app

Ojo: las variables de entorno **no** viajan con el push. Sin `ANTHROPIC_API_KEY`
en Vercel, las descripciones salen en inglés y el panel de investigación no
renderiza. La DB en Vercel es efímera (se copia a `/tmp`): las escrituras en
producción no persisten.

## Fuentes de datos

Tres modelos según el dato:

1. **Series de mercado** (`src/lib/fuentes.ts`) → tabla `market_series`
   (upsert por `UNIQUE(fecha, instrumento, metrica)`). Fuentes pluggables con
   `Promise.allSettled`: una que cae no voltea al resto. Endpoints: data912
   (precios ARG), dolarapi, BCRA v4.0 (var 44=TAMAR, 7=BADLAR, 1=reservas),
   argentinadatos (riesgo país, IPC, UVA), Yahoo (global/commodities/Merval).
   `^TNX` ya viene en %.
2. **Datos live sin DB** (patrón equity, `src/lib/equity.ts`) → Yahoo Finance
   con caché en memoria del proceso + TTL. No toca SQLite. Para lo que se rebaja
   solo y no necesita histórico.
3. **rava** (`mercado.rava.com/api/prices/…`) — la base de los cronogramas.
   `/bonos` devuelve todas las especies con vencimiento, TIR y precio;
   `/bonos-flujo/{ticker}`, el cronograma. Pide `user-agent` y `referer`. **No se
   consulta en runtime**: alimenta los tres generadores de `scripts/`, que
   escriben los cronogramas al repo. Un cronograma de amortización no cambia, y
   así el panel no depende de que ese sitio esté arriba.
4. **BYMA open data** (agregado ago-2026) — `open.bymadata.com.ar`, la mejor
   base para renta fija argentina. API REST bajo
   `/vanoms-be-core/rest/api/bymadata/free/`. POST con body `{}`, cert válido
   (el `fetch` de Node entra directo, sin `-k`). `/cauciones` devuelve una fila
   por contrato: `daysToMaturity` (plazo), `denominationCcy` (ARS/USD),
   `settlementPrice` (TNA de hoy en %, 0 si no operó hoy),
   `previousSettlementPrice` (TNA del cierre anterior, en fracción),
   `tradeVolume`. La caución a 1 día en ARS es la líquida.
   Integrado (ago-2026): `src/lib/byma.ts` (fetch cacheado, patrón equity, sin
   DB) → la fuente `byma_caucion` en `fuentes.ts` llena `CAUCION1` (1 día ARS,
   antes carga manual) y el panel `Cauciones` en `/mercado` muestra la curva
   ARS + USD por plazo. Próximos endpoints a sumar de la misma base:
   soberanos (`titulos-publicos`), ONs (`obligaciones-negociables`).
5. **EE.UU. / Fed** (agregado ago-2026) — `src/lib/fred.ts` + `src/lib/fed.ts` +
   `src/lib/eeuu.ts`, todo con caché en memoria (patrón equity), sin DB, así que
   anda igual en el deploy efímero.
   - **FRED sin API key**: el endpoint del graficador es público →
     `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2020-01-01`.
     Misma data que la API oficial, sin trámite.
     **Trampa verificada**: acepta varias series separadas por coma sólo si
     comparten frecuencia *exacta*; si se mezclan —incluso dos semanales con
     distinto día de corte, ICSA (sábado) y WALCL (miércoles)— responde un ZIP
     binario en vez de CSV. Por eso `fredSerie()` pide **una serie por request**.
     Las series usadas están listadas en `eeuu.ts`; ojo que el CPI y el PCE se
     publican como **nivel del índice**: la inflación hay que calcularla.
     La ventana de historia de cada serie vive en `VENTANA_ANIOS` (en `fred.ts`)
     y **no** se pasa por parámetro: el `cosd` forma parte de la clave del caché,
     así que dos paneles que pedían la misma serie con ventanas distintas hacían
     dos requests por el mismo dato.
     Tasas de otros bloques que sí están al día (ago-2026): `ECBDFR` (depósito
     BCE), `IUDSOIA` (SONIA), `IRSTCI01JPM156N` (call money Japón) y los 10 años
     `IRLTLT01{DE,GB,JP}M156N`. Las de Brasil (`IRSTCB01BRM156N`) y el Bank Rate
     del Reino Unido (`BOERUKM`) están discontinuadas: no usarlas.
   - **Callejones sin salida ya probados, no reintentar**: los futuros de dólar
     no tienen fuente abierta (BYMA devuelve 401 en `/futuros` y derivados;
     MatbaRofex pide credenciales), y los FCI de argentinadatos sólo publican
     `/ultimo` sin serie histórica, así que no se puede calcular el rendimiento
     de un money market.
   - **Futuros de fondos federales** (Yahoo, ya en el proyecto):
     `ZQ{código de mes}{AA}.CBT` — F=ene, G=feb, H=mar, J=abr, K=may, M=jun,
     N=jul, Q=ago, U=sep, V=oct, X=nov, Z=dic. Tasa implícita = `100 − precio`.
   - **federalreserve.gov**: el calendario del FOMC sale del HTML de
     `/monetarypolicy/fomccalendars.htm` (clases `fomc-meeting__month` y
     `fomc-meeting__date`; `Apr/May` + `30-1` = del 30 de abril al 1 de mayo; el
     `*` marca reunión con proyecciones). Los integrantes del Board salen de los
     links `/aboutthefed/bios/board/<apellido>.htm` — **el presidente se lee en
     vivo, nunca hardcodeado**: cambió en 2026 (hoy Kevin Warsh; Powell sigue
     como gobernador). RSS: `/feeds/{speeches,press_monetary,testimony}.xml`.
   - **Calendario de publicaciones de datos: no hay fuente abierta.** BLS
     bloquea bots (403 tanto en `bls.ics` como en las páginas, con cualquier
     User-Agent) y `fred.stlouisfed.org/releases/calendar` no responde. No
     volver a intentarlo: lo verificable es el calendario del FOMC y la fecha
     del último dato de cada serie.
6. **REM del BCRA** (agregado ago-2026) — `src/lib/rem.ts`, caché en memoria
   6 h, sin DB. La inflación que el mercado espera para el **mes en curso**, que
   es lo que el IPC de INDEC no puede contestar todavía. Se muestra en `/mercado`
   (`Rem.tsx`), arriba de los tiles.
   - **No hay API.** Dos caminos probados y descartados: la **API v4.0 del BCRA**
     sólo publica la variable 29 (mediana i.a. esperada a 12 meses), sin sendero
     mensual; y **apis.datos.gob.ar** tiene el dataset del REM completo
     (`430.1_REM_IPC_NAL_T_M_0_0_25_28` y familia) pero **congelado en dic-2025**,
     así que para "el mes en curso" no sirve. No volver a intentarlos.
   - Queda el **xlsx de resultados** del propio BCRA, que sí está al día. El link
     se lee de la portada (`/relevamiento-expectativas-mercado-rem/`, la vieja
     `.asp` redirige ahí): el nombre del archivo lleva el mes
     (`tablas-…-jul-2026.xlsx`), así que hardcodearlo lo deja viejo en la próxima
     publicación. `fetch` pelado de Node, sin user-agent.
   - **El xlsx se parsea a mano, sin dependencias**: un .xlsx es un zip con XML,
     y son ~60 líneas entre el directorio central y `inflateRawSync`. En la
     columna B las fechas son series de Excel (días desde el 30/12/1899, siempre
     fin de mes: leerlas en UTC) y los textos viven en `sharedStrings` con
     `t="s"` en la celda. Si el cuadro cambia de forma, el parseo tira y la
     tarjeta no se dibuja: nunca inventa un número.
   - **El REM no es una proyección del BCRA** —lo aclara el propio banco arriba
     de la publicación—: es la mediana de lo que pronostican consultoras, centros
     de investigación y bancos. La tarjeta lo dice al pie, porque leerlo como
     meta oficial cambia lo que significa. Por lo mismo va con el rango p25–p75:
     una mediana sin dispersión no se puede interpretar.
   - Se releva los últimos 3 días hábiles del mes y se publica en los primeros
     del siguiente, así que **el dato del mes en curso siempre sale del REM
     anterior** (el de julio trae ago-26). El cuadro cubre de `t` a `t+6`: el mes
     corriente siempre está.

7. **Radar / WhatsApp** — `src/lib/radar.ts`, tabla `radar_items`. Clasifica un
   volcado crudo con el SDK de Anthropic (`claude-opus-5`, `output_config` con
   `effort: "medium"` y `format: json_schema`) y guarda sólo lo que sobrevive.
   Entra por la caja de pegado de `/radar` o por `POST /api/radar/ingest` con
   header `x-radar-token` (variable `RADAR_TOKEN`), pensado para un Atajo de iOS
   en la hoja de compartir. **No hay API de canales de WhatsApp**: eso es lo más
   automatizable sin automatizar un cliente web, que rompe los términos.
   Necesita `ANTHROPIC_API_KEY`; sin ella la caja muestra el error y no rompe.

## Convenciones

- Commits en castellano, descriptivos, con prefijo convencional:
  `feat(equity): …`, `fix(renta fija): …`.
- Patrón Next: Server Component (data con `getDb` / `fetch`) + Client Component
  (interactividad) + server action con `revalidatePath`.
- Formato es-AR: `1.607,00`, porcentajes con coma. Helpers en
  `src/lib/equity-formato.ts`.
- `serverExternalPackages: ['better-sqlite3']` en `next.config.ts`.
- Los paneles de `/eeuu` resuelven cada uno su propio fetch dentro de un
  `Suspense`: la página aparece entera aunque una fuente esté lenta. En
  `/renta-fija` el fallback del Suspense de la curva soberana es **el mismo
  gráfico sin el Tesoro**, así que se ve completo desde el primer frame y se
  enriquece cuando FRED contesta.
- Registro editorial en `/renta-fija` (inspirado en breakeven.ar): títulos
  serif vía prop `serif` de `Card` y `EncabezadoPagina` (usa `font-serif` ≈
  Georgia, sin cargar fuente). El resto de la app sigue con headers en
  versalitas sans. `CurvaNS` acepta `referencias`: líneas horizontales de
  contexto (Tesoro 10a, TIR implícita del riesgo país) contra las que se lee
  la altura de la curva.

## Riesgo país: intradiario de rava, cierre de argentinadatos

argentinadatos publica el **cierre**: a media mañana el panel seguía mostrando
el número del día anterior (500 cuando ya estaba 493). Rava lo actualiza durante
la rueda.

`src/lib/rava.ts` lo saca del bloque `<script type="application/ld+json">` de
`rava.com/perfil/RIESGO PAIS`: un `FinancialProduct` de schema.org con
`offers.price`. **Es dato estructurado, no HTML de presentación** —está ahí para
Google— así que sobrevive rediseños que romperían un selector de CSS. El
`robots.txt` de rava.com no bloquea nada (`Disallow:` vacío).

Cuatro cosas del armado:

- **El orden en `FUENTES` importa.** `ravaFuente` va **antes** que
  `argentinaDatosFuente`. Las dos upsertean con `ON CONFLICT DO UPDATE`, así que
  la última gana: mientras las fechas difieren no se pisan, y el día que
  argentinadatos publique el cierre de hoy, ese cierre le gana al intradiario.
  Un cierre oficial vale más que una foto de las once.
- **El fin de semana no escribe.** Rava sigue mostrando el último cierre;
  estamparlo con la fecha de hoy inventaría un sábado plano que nunca cotizó.
- **La fecha se calcula en la zona de Buenos Aires**, no con `localDateStr()`:
  en Vercel el servidor está en UTC y después de las 21 hs de Argentina el valor
  quedaría con la fecha del día siguiente.
- **Guarda de rango: 50 a 30.000 pb.** Fuera de ahí lo que volvió no es el
  riesgo país (es un cero, o un parseo que salió mal) y entraría a la serie para
  quedarse. Si rava falla o cambia, tira y argentinadatos sigue siendo la fuente
  del cierre y del histórico entero: lo único que se pierde es la frescura.

## La fuente al pie de cada gráfico

Bauty lo pidió explícito y es la regla del `Card` llevada hasta el final: **todo
gráfico dice de dónde salió el número**. Un panel de precios sin eso obliga a
confiar de memoria, y cuando dos series del mismo indicador no coinciden —el
riesgo país intradiario contra el cierre— sin decir cuál se mira, la diferencia
parece un error.

- `src/lib/fuentes-credito.ts` mapea ticker → `{ fuente, url, nota }`, más
  `CREDITOS` para los gráficos que no salen de un ticker del panel (curva del
  Tesoro, sendero de la Fed, composición de un ETF).
- **Es un módulo aparte de `fuentes.ts` a propósito**: ese sabe qué fuente cubre
  qué ticker pero arrastra yahoo-finance2 y no puede viajar al navegador. La
  contrapartida es mantener las dos en línea; el chequeo es que todo ticker con
  fuente automática tenga crédito (hoy: 39 de 39).
- `src/components/Fuente.tsx` lo dibuja: fuente, link para verificar y la letra
  chica que cambia cómo se lee ("mediana de las TNA que publican los bancos" no
  es lo mismo que "la TNA").
- Puesto en: los dos cards del hero y sus dos modales, Panorama, REM, Cauciones,
  el mapa de provincias, los cuatro paneles de EE.UU., las cinco curvas de renta
  fija y próximos pagos, la torta de sectores de ETF, el ranking de equity y los
  siete cards de la página de una empresa.

## El hero de macro: los gráficos del dólar y el riesgo país

`HeroMacro.tsx` son los dos cards que abren `/mercado`. La cifra grande y la
serie dibujada contestan "cuánto está" y "para dónde viene", pero no contestan
la que se hace todos los días: **cómo vienen los cinco dólares entre sí**. El
CCL solo no dice si la brecha se abre ni si el blue se adelantó.

`DetalleSeries.tsx` (cliente) envuelve las zonas del hero y abre un modal con
gráfico multi-serie de Recharts. Es distinto del `SeriesModal` de los tiles de
abajo, que es de una serie sola.

- **Una vista por unidad, no una línea por serie.** Los cinco dólares comparten
  el eje en pesos y superpuestos se leen de una. La brecha (%), las reservas
  (US$) y la base (pesos) van como *vistas* aparte: dos escalas en un eje es un
  gráfico que miente.
- **Las series se cruzan por unión de fechas, no por intersección.** No
  comparten calendario —el mayorista tiene 270 puntos donde el CCL tiene 409, el
  riesgo país lo publica JP Morgan con su propio rezago— y la intersección
  tiraría datos buenos. Los huecos se unen con `connectNulls`.
- **El dominio del eje se calcula sobre las series prendidas.** Apagar el blue
  reajusta el eje y las diferencias dejan de verse aplastadas.
- **Cada celda del pie abre el gráfico con esa serie y el CCL prendidos.** La
  pregunta mirando el blue no es cuánto vale: es cuánto le saca al de
  referencia.

### La trampa del payload (medida)

Las series cruzan al cliente **enteras y por referencia**, sin `.slice()`.
Recortar a un año parece que tiene que pesar menos y pesa **178 KB más**:
`MercadoClient` ya recibe `datos.series` completo, así que esos arrays ya están
viajando, y pasando el mismo objeto React los serializa una vez y el hero los
referencia. Un `.slice()` crea arrays nuevos y los manda de nuevo. Medido en el
dev server: 791 KB con slice, 613 KB sin. **Cuando dos componentes de una misma
página necesitan los mismos datos, pasar la misma referencia es más barato que
recortarla.**

## Curvas y cronogramas

Cuatro curvas en `/renta-fija`, cada una con su generador en `scripts/`. Los
tres generadores comparten el mismo control y **no es decorativo**: se descuenta
el cronograma propio a la TIR que publica rava y si no reproduce el precio de
mercado, el instrumento no entra. Un vencimiento mal deducido de un ticker da
una TIR mal calculada, y eso es peor que no mostrar el instrumento.

| Curva | Cronogramas | Generador |
|---|---|---|
| Soberanos hard-dollar y ONs | `bonos-flujos.ts` | `generar-flujos-bonos.mjs` |
| CER y dólar linked | `bonos-flujos-ars.ts` | `generar-flujos-ars.mjs` |
| Tasa fija (Lecaps/Boncaps) | `bonos-flujos-tasa-fija.ts` | `generar-flujos-tasa-fija.mjs` |

**Las familias se reconocen por el patrón del ticker** y mezclarlas rompe la
curva: `S…`/`T…` + día + mes en letra + año son tasa fija; `TX`/`TZX`/`X…` son
CER; `TZV`/`D…` dólar linked; **`TXM…` es TAMAR**, comparte prefijo con los
Boncer y rinde 40% nominal contra 10% real.

**Los archivos de tasa fija caducan.** Las Lecaps rotan con cada licitación, así
que hay que volver a correr el generador cada tanto. La curva avisa en pantalla
cuántos instrumentos ya vencieron en vez de irse adelgazando en silencio.

Los mismos cronogramas alimentan el calendario de próximos pagos
(`calendario-pagos.ts`). Los CER y dólar linked se muestran ahí estimados con el
índice de hoy y **marcados**: pagan por el índice de su fecha de pago, que
todavía no existe, así que el pago real va a ser mayor.

## Ficha de análisis (equity)

`/equity/[ticker]/ficha` — la plantilla de trabajo del analista sobre una
empresa: negocio, moat, management, números, deuda, valuación, tesis y kill
criteria. Es **lo único del dashboard que no se puede volver a bajar de una
fuente**: todo lo demás se recupera solo, esto es criterio propio.

- **Plantilla como dato.** Las diez secciones se declaran en
  `src/lib/equity-ficha.ts` (`SECCIONES`) y la pantalla las recorre. Agregar un
  campo es una línea; la completitud se cuenta sola. Desde sep-2026 `SECCIONES`
  es la **unión** de lo que cualquier perfil puede pedir y lo que se dibuja sale
  de `seccionesDe(perfil)` — ver abajo.
- **Dos módulos, no uno.** `equity-ficha.ts` es puro (plantilla, tipos,
  `avanceDe`, `estimarWacc`) porque lo importa el componente cliente;
  `equity-ficha-db.ts` tiene la persistencia. Es la misma trampa que
  `fuentes.ts`: un import de `better-sqlite3` en el bundle del navegador no
  compila.
- **Un JSON, no sesenta columnas** (tabla `equity_fichas`). Es un documento, no
  un dataset: la plantilla se va a seguir moviendo y cada cambio sería una
  migración.
- **Autoguardado al salir del campo, sin revalidar la ruta.** El borrador vive
  en el cliente; revalidar en cada blur volvería a pedirle a Yahoo la serie
  financiera entera para redibujar un párrafo. El sello de guardado se muestra
  siempre: autoguardar sin señal es peor que un botón.
- **Lo que el dashboard ya sabe no se pregunta.** Precio, market cap, EV, el
  cuadro entero de la sección 5, los múltiplos contra los pares y la fecha del
  próximo balance se completan solos (`Bloques.tsx`). Una ficha que pide tipear
  el margen bruto de cinco años no se llena nunca, y peor: se llena mal.

### La plantilla se adapta al papel (`equity-perfil.ts`)

Era una sola plantilla de 43 campos para las 2.126 empresas del universo, y
Bauty lo marcó bien: **en cualquier papel concreto sobra medio formulario**. A
una empresa de software de Texas le preguntaba si cobra en pesos y debe en
dólares, con una tabla de %USD/%ARS, y le ofrecía "toneladas, m² alquilados"
como driver de ingresos. Un cuestionario que no es de esta empresa no se
contesta: se saltea.

`perfilDe({ sector, industria, argentino })` clasifica en **16 perfiles** con
regex sobre la industria de Nasdaq —que es mucho más fina que el GICS: "Major
Banks", "Precious Metals", "Computer Software: Prepackaged Software"— y cae al
sector cuando no matchea. Sobre 2.127 papeles quedan 22 en `generico`, y son
los que vienen con sector "Otros" y sin industria.

`seccionesDe(perfil)` devuelve la plantilla resuelta: filtra por `solo` /
`excepto` / `geografia` y reemplaza label, pista y opciones por las del perfil
(`porPerfil`). GTLB pregunta por NRR, churn y dilución por SBC; AEM por AISC,
ley del mineral y vida de mina; JPM por mora, CET1 y "¿ROE > costo del
capital?" en vez de ROIC, sin tabla de vencimientos de deuda y con la grilla de
métodos cambiada por P/BV × ROE. YPF conserva el descalce de monedas y suma
riesgo político.

Cuatro cosas para no volver a tropezarse:

- **La validación al guardar va contra la unión, nunca contra la plantilla del
  papel.** Si Yahoo cambia la industria de un ticker, lo que ya está escrito se
  tiene que poder seguir guardando. `CLAVES` y `esCampoValido` se arman sobre
  `SECCIONES` (la unión), no sobre `seccionesDe()`.
- **Y lo que quedó escrito con otra plantilla se muestra igual.**
  `camposHuerfanos()` lo detecta y la ficha lo pinta en un card al final. Sin
  eso sería texto en la base que nadie puede ver ni borrar.
- **`resolver()` devuelve un objeto nuevo, no un spread.** Las secciones cruzan
  a un Client Component: un `...campo` mandaba el `porPerfil` entero —las 16
  variantes de cada pregunta— dentro del HTML de cada ficha. Eran 16 KB por
  página para que el navegador descarte quince plantillas.
- **El orden de las reglas importa.** "Finance: Consumer Services" tiene que
  caer en `banco` antes de que `consumo` lo agarre por la palabra; "Electrical
  Products" es industrial y no una utility (por eso la regex dice `electric
  power`, no `electric`); el carbón se mina y va a `minera`, no a `energia`.

### El núcleo y lo opcional

`avanceDe()` mide **sólo los 19 campos del núcleo** (`nucleo: true`), no los 43.
Antes una ficha con la tesis, la valuación y los kill criteria escritos marcaba
40%: desalienta y además miente sobre qué falta. El resto arranca plegado
detrás de un "N campos más" por sección, y se cuenta aparte.

### Radiografía: qué está pasando con el papel (Finviz)

Arriba de las diez secciones. `src/lib/finviz.ts` baja la tabla de
`finviz.com/quote.ashx?t=TICKER` —`robots.txt` la permite; sí bloquea
`/export`, `/screener?*` y los gráficos— y `finviz-lectura.ts` la convierte en
una lectura. Caché de 30 minutos, sin DB.

- **Trae lo que Yahoo no da**: PEG, crecimiento esperado a 5 años del consenso,
  short float y short ratio, insiders e institucionales (tenencia y movimiento
  del trimestre), posición contra SMA20/50/200, RSI, sorpresa del último
  balance y precio objetivo.
- **Formatos a desarmar**: sufijos `B/M/K` en escala inglesa, celdas con dos
  valores (`344.57 -5.33%`, `39.86% 18.41%`), dividendo como `2.10 (0.36%)`. Un
  `-` es **sin dato**, no cero: `Number("-")` da NaN, y una empresa sin
  dividendo no es igual a una que lo cortó.
- **Es scraping y se asume**: si el HTML cambia, `getFinviz` exige un mínimo de
  40 métricas y tira; el panel no se dibuja y la ficha sigue entera. Mejor sin
  panel que con números de origen desconocido.

**Lo que hace útil al panel son las tensiones, no las métricas.** Noventa
números con otra tipografía no son un análisis; el hallazgo es el cruce que no
cierra. El caso que ordenó el módulo fue META (1-sep-2026): ventas +27,7% con
ganancia por acción −5%, EV/EBITDA 13,7 contra P/FCF 36, y 27% abajo del máximo
con el consenso en compra fuerte. Cada número solo no dice nada; los tres juntos
dicen que está gastando en algo que todavía no rinde, y de qué depende la tesis.

- **Los umbrales son sectoriales y hay que gatearlos.** Deuda/patrimonio de 3
  en un banco es el negocio, no una alarma: `esApalancadaPorDiseño()` apaga las
  reglas de apalancamiento y de capex para `Financials` y `Real Estate`. Sin
  eso, NU disparaba "la deuda manda sobre el resultado" — ruido con formato de
  hallazgo. Cualquier regla nueva se piensa contra un banco antes de escribirla.
- **El panel no dice comprar ni vender.** Describe, nombra de qué depende y deja
  la **postura** —campo con chips en la sección 9— al analista. Una máquina de
  reglas con umbrales fijos no puede firmar una recomendación.

### La serie financiera

`getSerieFinanciera()` en `equity.ts`: cinco requests a `fundamentalsTimeSeries`
—`financials`, `balance-sheet` y `cash-flow` anuales, más `financials` y
`cash-flow` en `trailing` para la UDM—, cacheados un día y con `allSettled`
(media tabla es mucho mejor que ninguna).

- **Yahoo publica cinco ejercicios, no diez.** Pedir desde 2014 devuelve lo
  mismo que pedir desde 2021. La ficha lo dice en pantalla en vez de dejar
  pensar que la empresa no tiene más historia.
- **Devuelve filas de relleno**: el año más viejo suele venir sin estado de
  resultados. El eje sale de la unión de los tres módulos y después se tiran los
  períodos sin ningún dato — una columna entera de guiones corre la tabla y no
  informa nada.
- **La UDM no tiene balance propio** (un balance es una foto, no un acumulado):
  sus ratios de deuda y retorno se calculan contra el último cierre anual.
- Claves útiles: `normalizedEBITDA` (mejor que `EBITDA`: el reportado se ensucia
  con cargos de una sola vez), `EBIT`, `investedCapital`, `taxRateForCalcs`,
  `netDebt`, `freeCashFlow`, `interestExpense`, `receivables`/`payables`/
  `inventory` (ciclo de conversión).

### WACC estimado

CAPM en `estimarWacc()`, con los tres supuestos a la vista en el tooltip porque
ninguno es "el correcto": tasa libre = Tesoro a 10 años de FRED, prima de
mercado = 5% (orden de magnitud de Damodaran para EE.UU.), costo de deuda =
intereses pagados sobre deuda total del último balance —la tasa que paga hoy, no
la que conseguiría emitiendo ahora—. El peso va a valor de mercado del equity
contra deuda contable, que es la convención práctica. Es la vara del ROIC: un
negocio que rinde 9% y se financia al 11% destruye valor por más que gane plata.

### Riesgo del papel (`equity-riesgo.ts`)

Volatilidad, beta propia, drawdown, Sharpe/Sortino y captura de alza/baja sobre
la serie de cierres. Es **cuenta pura, sin fuente nueva**: la única entrada es
`getSerieLarga()` (tres años, cacheada 6 h) del papel y de SPY, más DGS10 de
FRED para el Sharpe. Va en la página del ticker, debajo de Retornos.

- **Ventana de tres años, no trece meses.** `getSerie()` (400 días) alcanza para
  los retornos del ranking pero no para un desvío ni una beta: con un solo año
  cualquier susto puntual se come el número.
- **Beta propia ≠ beta de Yahoo.** Yahoo publica 5 años mensuales; esta va con
  las ruedas diarias de la ventana. Cuando difieren, la diferencia es
  información: el papel cambió de comportamiento.
- **Alinear las dos series por fecha antes de la regresión.** Sin eso la beta
  compara ruedas distintas (feriados de EE.UU. contra los del papel).
- Desvío muestral (n−1), 252 ruedas por año, retornos simples. Los cierres no
  están ajustados por dividendos: la volatilidad y la beta no se ven afectadas,
  el retorno acumulado de un papel que paga sí queda subestimado, y se aclara en
  pantalla.

### DCF inverso (`equity-valuacion.ts`)

La sección 8 de la ficha pedía escribir a mano "qué descuenta el precio hoy".
Se calcula: con FCF, WACC, deuda neta y acciones, el crecimiento implícito es el
único número que hace cerrar la ecuación. Diez años de crecimiento constante +
perpetuidad de Gordon al 2,5%, y se resuelve `g` por **bisección** (el valor es
monótono creciente en `g`). Va en la página del ticker y, con matriz de
sensibilidad 5×5, en la ficha.

Cuatro cosas que se aprendieron probándolo contra tickers reales:

- **En los financieros no aplica y hay que decirlo.** JPM da −162 mil millones
  de "caja libre" UDM porque el FCO de un banco se mueve con depósitos, cartera
  y trading. Mostrar eso como "quema caja" es un error de lectura grave: el
  panel muestra la explicación y nada más (`SIN_FCF` en `equity-analisis.ts`).
- **Los crecimientos de referencia hay que recortarlos.** El consenso de Finviz
  proyecta EPS a **cinco** años y el modelo pide diez: con NVDA en 64% anual, el
  escenario daba +564% de potencial. Techo en 25% (`TECHO_ESCENARIO`), con el
  original visible al lado, y la lectura dice que esa referencia no es
  proyectable en vez de compararla.
- **CAGR punta a punta no sirve con cuatro puntos.** La caja libre de Apple
  entre 2022 y 2025 da −3,9% anual por un 2022 alto y un 2025 flojo, cuando lo
  que hizo fue quedarse quieta. Se ajusta una recta a los logaritmos y se
  anualiza la pendiente (`crecimientoTendencial`), con los **años de cierre**
  como eje x para que un ejercicio faltante cuente como el hueco que es.
- **El punto de partida es una decisión.** El FCF UDM de Apple está 30% arriba
  del promedio de los ejercicios cerrados; el de NVDA, 170%. Si la desviación
  pasa de 25% el panel lo dice: todo el ejercicio se apoya en ese número.

Acciones = capitalización / precio (el `sharesOutstanding` de Yahoo llega
desfasado en las que recompran). Deuda neta = EV − capitalización, que es la que
el mercado usa hoy; se cae a la del último balance si no hay EV.

## Cuentas que vale la pena no volver a derivar

- **Sendero implícito de tasa (FedWatch casero).** El contrato ZQ de un mes
  liquida contra el promedio diario de la EFFR de ese mes. Con una reunión que
  termina el día D de n, `tasa_mes = (D/n)·previa + ((n−D)/n)·nueva`. **No
  despejar mes a mes encadenando**: cuando la reunión cae cerca de fin de mes
  (28 de octubre, 28 de abril) el divisor `(n − D)` queda en dos días y el ruido
  del precio se amplifica quince veces — daba saltos de 280 pb en una reunión.
  Se plantea el sistema entero (una ecuación por contrato, `r_0` = EFFR de hoy
  conocida) y se resuelve por **mínimos cuadrados**: así la reunión del 28 de
  octubre la determina sobre todo el contrato de noviembre, que la contiene
  entera. Está en `getSenderoFed()`.
- **Duration de un bono del Tesoro a la par.** FRED publica vencimientos
  constantes y la curva argentina se grafica contra duration. Para un bono a la
  par con cupón semestral: `duration modificada = [1 − (1 + y/2)^(−2n)] / y`
  (10 años al 4,67% → 7,9). Con eso las dos curvas comparten eje y el spread de
  cada Global se interpola a su propia duration en vez de leerse contra el 10
  años, que sobrestimaba el spread de los bonos cortos.
- **Breakeven de inflación**: Fisher entre la curva de tasa fija y la CER —
  `(1+nominal)/(1+real) − 1`—. La tasa real se lee del **ajuste** de la curva CER
  y no del Boncer más cercano: los vencimientos de las dos familias no coinciden
  y comparar una Lecap de noviembre contra un Boncer de marzo mete la pendiente
  de la curva adentro del número. Sólo dentro del rango donde la CER tiene bonos:
  un breakeven extrapolado se lee como un dato sin serlo.
- **TEM**: las Lecaps se cotizan en tasa efectiva **mensual**, no anual —
  `(1+TIREA)^(1/12) − 1`—. El gráfico va en anual para poder compararlo contra
  las otras curvas, pero la lista va en mensual, que es como se le explica a un
  cliente.
- **Tasa real de política**: efectiva menos PCE núcleo interanual (no IPC: la
  meta del 2% está definida sobre el PCE). Es la lectura que explica que el
  mercado descuente subas con una tasa nominal que parece alta.

## Trampas conocidas

- **"Sin historial" no es lo mismo que "sin fuente".** El panel de carga manual
  deducía qué ofrecer de `series[ticker].length === 0`, y esa equivalencia
  falla justo cuando molesta: un instrumento recién automatizado, o uno cuya
  fuente no publica los fines de semana, aparecía pidiendo carga a mano como si
  nadie lo cubriera (le pasaba a CAUCION1 en el deploy los sábados). Ahora la
  lista sale de `tieneFuenteAutomatica()` en `fuentes.ts` —derivada de las
  constantes de cada fuente, así que no se desincroniza— y viaja por
  `PanelDatos.sinFuente`, porque `fuentes.ts` importa yahoo-finance2 y no puede
  ir al bundle del navegador.
- **`seedGlossary` sólo corre con la tabla vacía.** Agregar términos ahí no hace
  nada en una instalación que ya viene andando. Para sumar términos hay dos
  seeds incrementales que insertan sólo lo que falta y nunca pisan una edición
  manual: `seedGlosarioInstrumentos` (los que mapean a un ticker del panel, en
  `glosario-instrumentos.ts`) y `seedGlosarioFed` (conceptos sueltos, en
  `glosario-fed.ts`). Un instrumento nuevo en el panel **necesita** su entrada en
  `glosario-instrumentos.ts` o queda sin popover.

- **`divide-x` en una grilla que envuelve deja líneas sueltas.** El separador se
  aplica a todos los hijos menos el primero, no al primero de cada fila: si la
  grilla cambia de columnas por breakpoint, aparece una raya vertical pegada al
  borde izquierdo en las filas 2 en adelante. Los separadores salen del `gap`
  sobre el fondo (`gap-px bg-divisor` + celdas `bg-card`), que anda igual con
  cualquier cantidad de columnas.

- **`.fade-up` + `position: fixed`**: la animación deja un `transform` aplicado
  que vuelve al elemento contenedor de sus hijos `fixed`. Todo overlay
  (paneles, popovers, modales) va por `createPortal` al `body`.
- **Una tabla nueva no aparece sin reiniciar el dev server.** `getDb()` cachea la
  conexión en `globalThis`, así que `initSchema` ya corrió: agregar un
  `CREATE TABLE IF NOT EXISTS` y recargar da `no such table`. O se reinicia el
  server, o se corre el DDL contra `data/dashboard.db` desde afuera (con WAL, un
  segundo proceso escribe sin problema). En producción no pasa: cada arranque en
  frío copia el snapshot y corre el schema entero.
- **Una tabla de filas fijas nunca está "vacía".** La primera columna es la
  etiqueta que pone la plantilla ("< 12 m"), no algo que haya escrito nadie: si
  cuenta para decidir si la tabla tiene contenido, una tabla intacta parece
  llena y la sección figura como empezada. Al guardar y al contar el avance se
  saltea esa columna.
- **DB versionada**: `/data/` está en `.gitignore` pero `dashboard.db` sigue
  trackeado de antes de esa regla. Para commitear datos: `git add -u` (un
  `git add data/…` se rechaza). Normalmente **no** commitear los cambios de la DB.
- **Carpetas con guión bajo en `app/` no son rutas.** Next las trata como
  privadas: una ruta de debug en `src/app/api/_debug/` devuelve el 404 sin
  ningún error. Costó un ciclo entero de depuración.
- **El caché en memoria sobrevive al hot reload.** Vive en `globalThis`, así que
  cambiar el código y recargar sigue devolviendo lo viejo: para probar un cambio
  en `fred.ts`, `fed.ts`, `byma.ts` o `equity.ts` hay que **reiniciar el dev
  server** (o usar el botón de refresco, que llama a `invalidarFred()`).
- **`.claude/` está gitignoreado**: por eso este archivo vive en la raíz, para
  que se commitee y viaje con el repo. `AGENTS.md` lo referencia para que se
  cargue en cada sesión.
