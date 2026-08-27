# Dashboard financiero — conocimiento operativo

Notas que se van acumulando sobre cómo trabajar en este proyecto: lo que
aprendo, lo que corrijo y las trampas que ya me comí. Bauty pidió mantener este
archivo al día con **cada cosa nueva que aprenda o mejore**.

## Qué es

Dashboard personal de un asesor financiero (Balanz). Sigue el mercado argentino
y global, fácil y rápido de leer. Next.js 16 + TypeScript + Tailwind v4 +
better-sqlite3 + Recharts + Anthropic SDK.

- Correr local: `npm run dev -- -p 3001` → http://localhost:3001
- `/` redirige a `/mercado`. Módulos: mercado, renta-fija, equity, etf,
  glossary, efemerides.

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

## Convenciones

- Commits en castellano, descriptivos, con prefijo convencional:
  `feat(equity): …`, `fix(renta fija): …`.
- Patrón Next: Server Component (data con `getDb` / `fetch`) + Client Component
  (interactividad) + server action con `revalidatePath`.
- Formato es-AR: `1.607,00`, porcentajes con coma. Helpers en
  `src/lib/equity-formato.ts`.
- `serverExternalPackages: ['better-sqlite3']` en `next.config.ts`.

## Trampas conocidas

- **`.fade-up` + `position: fixed`**: la animación deja un `transform` aplicado
  que vuelve al elemento contenedor de sus hijos `fixed`. Todo overlay
  (paneles, popovers, modales) va por `createPortal` al `body`.
- **DB versionada**: `/data/` está en `.gitignore` pero `dashboard.db` sigue
  trackeado de antes de esa regla. Para commitear datos: `git add -u` (un
  `git add data/…` se rechaza). Normalmente **no** commitear los cambios de la DB.
- **`.claude/` está gitignoreado**: por eso este archivo vive en la raíz, para
  que se commitee y viaje con el repo. `AGENTS.md` lo referencia para que se
  cargue en cada sesión.
