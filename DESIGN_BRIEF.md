# Brief de diseño — Dashboard Mercado

Contexto para rediseñar la UI. La lógica de datos ya está resuelta y funcionando:
**este documento pide cambios visuales, no de arquitectura.**

## Quién lo usa y para qué

Asesor financiero en Balanz (Argentina). Abre el dashboard **a la mañana, 10–15
minutos, antes de hablar con clientes**. Necesita entender en un vistazo cómo
viene el mercado argentino para poder opinar con criterio.

El éxito es: **entrar, mirar, entender el día, cerrar.** No es una herramienta de
análisis profundo — es un panel de situación.

## Qué existe hoy

- **`/mercado`** — el panel. Es la home (`/` redirige acá).
- **`/glossary`** — glosario financiero con precios live y fórmulas KaTeX.
- **`/efemerides`** — feriados argentinos (relevante: días sin mercado).

Stack: Next.js 16 (App Router, Server Components) · Tailwind v4 · Recharts ·
SQLite. Dark mode únicamente, paleta `slate` de Tailwind + acentos en `oklch()`.

## Estructura del panel

Grilla de dos columnas: contenido principal + sidebar angosto (carga manual).
El contenido se agrupa en **secciones por naturaleza del dato**. Esta separación
es deliberada y **no se debe romper**:

| Sección | Contenido | Unidad |
|---|---|---|
| Dólar | oficial, mayorista, MEP, CCL, blue, brecha | ARS |
| Tasas en pesos | TAMAR, BADLAR, plazo fijo, caución | % TNA (ARS) |
| Inflación | IPC mensual, IPC interanual, UVA | % / índice |
| Riesgo & reservas | riesgo país, reservas BCRA, base monetaria | pb / USD M / ARS |
| Global | UST 10Y, S&P 500, DXY, real brasileño | USD |
| Commodities | soja, petróleo Brent, oro | USD |
| Acciones Argentina | Merval, Merval en USD | índice |
| Soberanos hard-dollar | GD29–GD46 (ley NY), AL29–AL41 (ley AR) | USD (tabla) |

**La regla que originó estas secciones:** nunca poner una tasa en pesos (22% TNA)
al lado de un yield en dólares (4,7%) — se leen como comparables y no lo son.
Cada sección declara su moneda. Si el rediseño reordena cosas, esa separación
tiene que sobrevivir.

## Cómo se lee cada dato

Cada indicador muestra: **valor actual**, fecha del dato, **sparkline**, y tres
deltas — vs. dato anterior, 30 días, 90 días.

**La tendencia importa más que el nivel.** El delta no es decoración: es el dato.
Si el rediseño tiene que elegir entre destacar el número o el delta, destacar
ambos; si no entran los dos, el delta gana espacio sobre la fecha.

Colores de delta: verde = mejora, rojo = empeora. **Ojo: para riesgo país, IPC y
brecha la lógica está invertida** (bajar es bueno) y ya está implementado así.
Mantener esa semántica.

Click en cualquier indicador → modal con gráfico grande (Recharts `AreaChart`),
selector de rango 30d/90d/1año/todo, tooltip por fecha y los tres deltas.

## Qué mejorar

1. **Jerarquía visual.** Hoy todas las secciones pesan igual. El dólar y el riesgo
   país son lo primero que mira; commodities y global son contexto. Debería
   notarse.
2. **Densidad.** Entra bastante en pantalla pero se siente uniforme y plano.
   Buscar que el ojo caiga primero en lo importante.
3. **La tabla de soberanos** es la parte más sosa. Son 11 bonos donde lo
   interesante es comparar ley AR vs ley NY (ya diferenciados por color en el
   borde izquierdo).
4. **Estado vacío y de carga.** Hay indicadores sin datos ("caución 1 día") y un
   refresh automático al abrir que hoy se comunica con texto chico arriba a la
   derecha.
5. **Mobile.** Funciona (una columna) pero está sin trabajar.

## Restricciones

- **No romper la separación por moneda** de las secciones.
- **No inventar datos ni indicadores** en los mockups: los tickers y valores del
  documento son los reales.
- Dark mode. Números siempre con `tabular-nums` (alinean al comparar).
- Formato argentino: `$1.560` (punto de miles), `4,35%` (coma decimal).
- Sin dependencias nuevas: Tailwind v4 + Recharts es lo disponible.
- Los componentes son `.tsx` en `src/app/mercado/` y `src/components/`.

## Archivos

| Archivo | Qué es |
|---|---|
| `src/app/mercado/page.tsx` | Server Component: lee la DB, deriva brecha y Merval USD |
| `src/app/mercado/MercadoClient.tsx` | Todo el panel: secciones, tiles, tabla, sidebar |
| `src/app/mercado/SeriesModal.tsx` | Modal con el gráfico Recharts |
| `src/app/mercado/RefreshButton.tsx` | Botón ↻ y auto-refresh |
| `src/components/Sparkline.tsx` | Sparkline SVG inline (compartido con el glosario) |
| `src/lib/mercado.ts` | Tipos, grupos, formateo de valores y deltas |
