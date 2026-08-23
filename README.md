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

## Equity — monitor del S&P 500

Tres pantallas:

- **`/equity`** — rankea las 503 empresas del índice por cuánto se movieron.
  Franja con el S&P y los once sectores del día, retornos contra el índice
  (alpha), filtros guardados y agrupado por sector.
- **`/equity/<TICKER>`** — la ficha: gráfico de TradingView, fundamentals contra
  la mediana de sus pares, ventas y márgenes por año, resultados contra el
  consenso, analistas, noticias e investigación con fuentes.
- **`/equity/earnings`** — calendario de balances por semana. No cuesta ningún
  request extra: las fechas ya vienen en el lote que alimenta el ranking.

### Cómo se piden los datos

Todo sale de Yahoo Finance (`yahoo-finance2`) en dos etapas, separadas por costo:

| Etapa | Qué trae | Costo |
|---|---|---|
| `getTablero()` | Las 503 con precio, variación del día, 12 meses, distancia a medias, PER, capitalización y fecha de earnings | 3 requests |
| `conRetornos()` | Retornos exactos (1s/1m/3m/6m/YTD/12m) y sparkline | 1 request **por ticker** |

Por eso el ranking no calcula retornos exactos para las 503: preselecciona 120
candidatos con las métricas baratas y sobre esos hace el cálculo fino. El sesgo
que introduce está documentado en `src/lib/equity.ts`.

> **Ojo con las unidades de Yahoo:** algunos campos vienen en porcentaje
> (`regularMarketChangePercent`) y otros en fracción (`fiftyDayAverageChangePercent`,
> `profitMargins`, `dividendYield`), y `debtToEquity` ya viene en porcentaje.
> Está normalizado en `getTablero()` y `getFicha()`; si agregás un campo nuevo,
> verificá la unidad contra un cálculo a mano antes de mostrarlo.

No toca la base de datos: el caché es en memoria del proceso, con TTL (10 min el
tablero, 30 min las series, 1 hora las fichas). En Vercel la DB es efímera y
estos datos se rebajan solos, así que no hay nada que persistir.

### La capa de Claude

Dos cosas viven en `src/lib/equity-claude.ts` y necesitan `ANTHROPIC_API_KEY`.
Sin esa variable los paneles no se muestran y el resto de la ficha anda igual.

| Función | Qué hace | Costo aproximado |
|---|---|---|
| `getDescripcionEs()` | Traduce y condensa al castellano la descripción de Yahoo | fracción de centavo, cacheado 30 días |
| `getInvestigacion()` | Busca en la web contratos, clientes, proveedores e inversiones | unos centavos de dólar, cacheado 24 h |

**Por qué la investigación usa búsqueda web y no el conocimiento del modelo:**
un modelo respondiendo de memoria sobre contratos y clientes inventa nombres y
fechas que suenan perfectos. Esto termina en una conversación con un cliente,
así que cada afirmación tiene que tener una fuente que se pueda abrir. El prompt
le exige decir "no encontré información" antes que completar el hueco, y la
ficha muestra siempre la lista de páginas consultadas.

Modelo: `claude-opus-5` (igual que `/api/glossary/explain`).

### Actualizar el universo

La lista de constituyentes vive en `src/lib/equity-universo.ts` y está generada.
El índice cambia unas pocas veces al año; cuando pase:

```bash
node scripts/generar-universo-sp500.mjs
```

Baja la lista, **valida cada ticker contra Yahoo** y descarta los que no cotizan.
Escribe también `src/lib/equity-sectores.ts`. Ninguno de los dos se edita a mano.

> Los sectores están en su propio archivo porque los usa la UI: si la lista de
> 500 empresas viviera ahí, se iría entera al bundle del navegador (son 44 KB).

---

## Deploy

El deploy de este proyecto **no sale del push a git**: hay que correr
`vercel deploy --prod --yes` a mano.
