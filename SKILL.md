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
3. **BYMA open data** (agregado ago-2026) — `open.bymadata.com.ar`, la mejor
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
4. **EE.UU. / Fed** (agregado ago-2026) — `src/lib/fred.ts` + `src/lib/fed.ts` +
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
5. **Radar / WhatsApp** — `src/lib/radar.ts`, tabla `radar_items`. Clasifica un
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
- **Tasa real de política**: efectiva menos PCE núcleo interanual (no IPC: la
  meta del 2% está definida sobre el PCE). Es la lectura que explica que el
  mercado descuente subas con una tasa nominal que parece alta.

## Trampas conocidas

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
