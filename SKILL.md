# Dashboard financiero — conocimiento operativo

Notas que se van acumulando sobre cómo trabajar en este proyecto: lo que
aprendo, lo que corrijo y las trampas que ya me comí. Bauty pidió mantener este
archivo al día con **cada cosa nueva que aprenda o mejore**.

## Qué es

Dashboard personal de un asesor financiero (Balanz). Sigue el mercado argentino
y global, fácil y rápido de leer. Next.js 16 + TypeScript + Tailwind v4 +
better-sqlite3 + Recharts + Anthropic SDK.

- Correr local: `npm run dev -- -p 3001` → http://localhost:3001
- `/` redirige a `/mercado`. Módulos: mercado, renta-fija, equity, etf, **eeuu**,
  **radar**, glossary, efemerides.

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
