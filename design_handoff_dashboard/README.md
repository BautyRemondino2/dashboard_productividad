# Handoff: rediseño visual del dashboard financiero

## Overview

Rediseño completo de la interfaz del dashboard personal de research financiero: 6 páginas existentes (`/mercado`, `/renta-fija`, `/equity`, `/etf`, `/glossary`, `/efemerides`) más la página de detalle de ticker (`/equity/[ticker]`).

El objetivo del rediseño **no es cambiar la funcionalidad ni los datos**. Es cambiar cómo se ve y cómo se jerarquiza la información: densidad, tipografía, color, y el orden en que aparecen las cosas. Toda la lógica de datos, queries a SQLite, scrapers y cálculos existentes se mantienen tal cual.

Cambios estructurales que sí afectan al layout:

1. **Cinta fija de 6 números clave** (CCL, brecha, riesgo país, TAMAR, Merval USD, S&P) debajo del nav, presente en **todas** las páginas. Hoy esos números viven sólo en `/mercado` y desaparecen al navegar.
2. **Se elimina el sidebar de 340px** de `/equity/[ticker]`; su contenido baja a un bloque de ancho completo.
3. **Nav reordenado por frecuencia de uso real**: Macro · Renta fija · Equity · ETF | Glosario · Efemérides.
4. En `/equity/[ticker]`: el precio objetivo pasa de líneas de texto a una **barra de rango visual**; los fundamentals se agrupan por categoría con regla de lectura explícita; el próximo earnings sube al tope de la columna derecha; el consenso de analistas se vuelve visible de un golpe.

## About the Design Files

Los archivos en `mocks/` son **referencias de diseño escritas en HTML**. Son prototipos que muestran el aspecto y el comportamiento buscado — **no son código de producción para copiar y pegar**.

La tarea es **recrear estos diseños en el codebase existente**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4, usando los patrones ya establecidos en `src/app/` y `src/components/`. Los estilos en los mocks están escritos inline por una limitación de la herramienta de prototipado; en el codebase deben expresarse como clases de Tailwind (o utilidades en `globals.css` cuando corresponda), siguiendo la convención que ya usa el proyecto.

Los mocks usan un runtime propio (`support.js`, tags `<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ holes }}`). **Ignorar ese runtime por completo.** `<sc-for list="{{ x }}" as="item">` es simplemente `x.map(item => …)`. Los datos dentro de los mocks son de ejemplo, tomados de la app real; los valores reales vienen de las funciones que ya existen en `src/lib/`.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, tamaños y espaciados son finales. Recrear pixel-perfect con Tailwind. Cuando un valor del mock no cae en la escala de Tailwind (ej. `padding:11px 20px`, `font-size:17px`), usar valores arbitrarios (`p-[11px_20px]`, `text-[17px]`) — la densidad es intencional y no debe redondearse a la escala.

## Design Tokens

Paleta oscura, base slate desplazada a azul frío. Todos los valores son los usados literalmente en los mocks.

### Fondos
| Uso | Valor |
|---|---|
| Fondo de página | `#020617` |
| Nav (con blur) | `rgba(2,6,23,0.92)` |
| Cinta de indicadores | `linear-gradient(180deg,#070d1a,#050a14)` |
| Card destacada (Macro) | `linear-gradient(180deg,#0b1322,#080f1c)` |
| Card estándar | `#080f1c` |
| Card earnings (acento verde) | `linear-gradient(135deg,#0a1a12,#080f1c 70%)` |
| Chip / item de nav activo | `#141f33` |
| Botón secundario | `#0d1526` |

### Bordes
| Uso | Valor |
|---|---|
| Borde de nav / cinta | `#131c2e` |
| Divisor interno de cinta | `#101a2b` |
| Borde de card | `#17233a` |
| Divisor interno de card (header, filas) | `#131f33` |
| Borde de botón / chip outline | `#24344d` |
| Separador vertical en nav | `#1e293b` |
| Borde de card earnings | `#1f2c1f` |

### Texto
| Uso | Valor |
|---|---|
| Número grande / heading | `#f8fafc` |
| Texto principal | `#f1f5f9` |
| Cuerpo | `#e2e8f0` |
| Secundario | `#94a3b8` |
| Nav inactivo, label de dato | `#7c8ba1` |
| Label uppercase, nav terciario | `#5b6a80` |
| Metadato | `#64748b` |
| Metadato tenue (fechas, notas) | `#475569` |

### Semánticos
| Uso | Valor |
|---|---|
| Positivo / suba | `#34d399` |
| Negativo / baja | `#f87171` |
| Acento de marca (logo) | `oklch(48% 0.16 258)` |
| Acento verde (punto de sección, sparkline) | `oklch(70% 0.11 150)` / stroke `oklch(72% 0.11 150)` |
| Acento rojo (punto de sección riesgo) | `oklch(70% 0.11 30)` |

Los deltas usan flechas de texto `▲` / `▼`, no iconos.

### Tipografía

Familia única: **Geist** (Google Fonts, pesos 400/500/600/700), fallback `system-ui, -apple-system, sans-serif`. `-webkit-font-smoothing: antialiased` en body.

| Rol | Tamaño | Peso | Extras |
|---|---|---|---|
| Número hero (CCL) | 46px | 600 | `letter-spacing:-0.03em`, `line-height:1` |
| H1 de página | 26px | 600 | `letter-spacing:-0.02em` |
| Dato secundario grande | 19px | 600 | `letter-spacing:-0.01em` |
| Dato de cinta | 17px | 600 | `letter-spacing:-0.01em` |
| Nav item, dato de tabla | 13px | 500 | |
| Cuerpo / descripción | 13px | 400 | `line-height:1.55`, `text-wrap:pretty` |
| Header de card (H2) | 12px | 600 | uppercase, `letter-spacing:0.12em` |
| Metadato, delta | 11px | 400–500 | |
| Label uppercase | 10px | 400 | uppercase, `letter-spacing:0.10–0.11em` |
| Micro-label de leyenda | 9px | 400 | uppercase, `letter-spacing:0.11em` |

**Toda cifra lleva `font-variant-numeric: tabular-nums`.** Sin excepción — es lo que permite comparar columnas de números de un vistazo.

### Radios, espaciado, sombras
- Radio de card: `14px`. Chip / nav item / botón: `7px`. Badge outline: `6px`. Logo: `6px`. Punto / pill: `9999px`.
- Sin sombras. La separación es por borde y por fondo, nunca por elevación.
- Contenedor de contenido: `max-width:1440px`, `margin:0 auto`, `padding:26px 24px 0`, `padding-bottom:64px` en el wrapper.
- Gap de grilla principal: `16px`. Gap entre bloques de un card: `18–28px`. Padding de card header: `12–14px 18–20px`.
- Alto de nav: `48px` (sticky, `top:0`, `z-index:20`). Cinta: sticky `top:48px`, `z-index:19`.

## Shell compartido (aplica a las 7 páginas)

### `TopNav` — `src/components/TopNav.tsx`
Alto 48px, sticky. De izquierda a derecha:
- Logo: cuadrado 22×22, radio 6px, fondo `oklch(48% 0.16 258)`, letra `b` 11px/700 en `#f1f5f9`. A su derecha "ASESOR" 11px/600 uppercase `letter-spacing:0.14em` color `#64748b`. Bloque con `margin-right:28px`.
- Items primarios (13px/500, `padding:6px 11px`, radio 7px): Macro, Renta fija, Equity, ETF. Activo: color `#f1f5f9` sobre `#141f33`. Inactivo: `#7c8ba1`, sin fondo.
- Separador vertical 1×16px `#1e293b`, `margin:0 10px`.
- Items terciarios (13px/400, color `#5b6a80`): Glosario, Efemérides.
- `margin-left:auto`: indicador de próximo feriado (punto 6px `#34d399` + texto `#94a3b8` + " · en N días" en `#64748b`, 11px), timestamp "actualizado HH:MM" 11px `#475569` tabular-nums, y botón de refresh `↻` (11px/500, `padding:5px 11px`, radio 7px, borde `#24344d`, fondo `#0d1526`, color `#cbd5e1`).

Hover de nav item: fondo `#101a2b`, color `#cbd5e1`.

### Cinta de indicadores — **componente nuevo**
Sticky bajo el nav. 6 celdas `flex:1 1 0`, `min-width:118px`, `padding:11px 20px`, divisor derecho `#101a2b`, `overflow-x:auto` en móvil. Cada celda: label uppercase 10px `#5b6a80` + valor 17px/600 `#f1f5f9` tabular-nums + delta 11px/500 en verde/rojo, alineados por `align-items:baseline` con `gap:8px`.

Contenido: CCL, Brecha, Riesgo país, TAMAR, Merval USD, S&P 500.

Los datos ya se obtienen en `src/lib/mercado.ts` y `src/lib/panel-datos.ts`. Para que la cinta viva en todas las páginas hay que **subir el fetch al layout**: `src/app/layout.tsx` la renderiza junto al `TopNav`. Es un server component; considerar `revalidate` o cache compartida para no repetir la query por navegación.

### Card
Patrón único, repetido en todas las páginas:
```
border-radius:14px; border:1px solid #17233a; background:#080f1c; overflow:hidden
└ header  padding:12px 18px; border-bottom:1px solid #131f33; display:flex; align-items:baseline; gap:10px
   ├ (opcional) punto 6×6 radio 9999px con color de acento de la sección
   ├ H2  12px/600 uppercase letter-spacing:0.12em color #cbd5e1
   ├ subtítulo  11px #475569  (unidad, fuente del dato, criterio)
   └ margin-left:auto → fecha del dato o badge de fuente, 11px #475569
└ body
```
El subtítulo del header es parte del diseño, no decoración: cada card declara de dónde viene el dato y contra qué se compara.

## Screens / Views

### 1. Macro — `/mercado`
Archivos: `src/app/mercado/page.tsx`, `MercadoClient.tsx`, `Gobierno.tsx`, `MapaProvincias.tsx`, `SeriesModal.tsx`, `DefinicionPopover.tsx`, `RefreshButton.tsx`
Mock: `mocks/Dashboard rediseño.dc.html`

Encabezado de página: H1 "Macro Argentina" 26px/600 + subtítulo 13px `#64748b` con fecha y cobertura de indicadores ("23 de 24 indicadores con dato de hoy"). A la derecha, párrafo resumen de 13px/1.55 `#94a3b8`, `max-width:420px`.

Grilla principal `grid-template-columns:1.55fr 1fr; gap:16px; align-items:stretch`.

**Card Dólar** (columna ancha, fondo degradado `linear-gradient(180deg,#0b1322,#080f1c)`, punto de acento verde):
- Bloque hero: label "CONTADO CON LIQUI" 11px uppercase + valor 46px/600 `#f8fafc` + delta 14px/500. Debajo, fila de 3 métricas (30 días, 90 días, y "Brecha vs. oficial" separada por `border-left:1px solid #17233a` con `padding-left:18px`).
- A la derecha del hero, sparkline SVG `viewBox="0 0 320 92"`, `preserveAspectRatio:none`, alto 92px: área con gradiente vertical `oklch(70% 0.11 150)` de opacidad 0.26 → 0, línea `stroke-width:1.6` con `vector-effect:non-scaling-stroke`.
- Pie: grilla de 4 columnas (oficial, MEP, tarjeta, mayorista) separadas por `border-right:1px solid #131f33`, cada una con nombre 11px `#7c8ba1`, valor 19px/600, delta 11px y sparkline mini 52×16 alineado a la derecha.

**Card Riesgo & reservas** (columna angosta, punto de acento rojo `oklch(70% 0.11 30)`): mismos patrones a escala menor.

Debajo: inflación, tasas, actividad, gobierno y mapa de provincias — mantener el contenido actual, reencuadrado en el patrón de card descrito. Ver el mock para el orden exacto.

Modales (`SeriesModal`) y popovers (`DefinicionPopover`) heredan el fondo de card `#080f1c` con borde `#17233a`.

### 2. Renta fija — `/renta-fija`
Archivos: `src/app/renta-fija/page.tsx`, `CurvaSoberanos.tsx`, `CurvaOns.tsx`
Mock: `mocks/Renta fija rediseño.dc.html`

Curvas primero (soberanos y ONs), tablas después. Los ejes y grillas de los SVG usan `#17233a`; las etiquetas de eje 10px `#5b6a80`. Puntos de curva con el color semántico según TIR. Tablas: header de columna 10px uppercase `letter-spacing:0.11em` `#5b6a80`, filas separadas por `#131f33`, hover de fila `#0b1322`, todas las cifras tabular-nums, alineadas a la derecha.

### 3. Equity (listado) — `/equity`
Archivos: `src/app/equity/page.tsx`, `EquityClient.tsx`, `FranjaEtf.tsx`, `Referencias.tsx`, `RefrescarEquity.tsx`, `actions.ts`
Mock: `mocks/Equity rediseño.dc.html`

Tenencias arriba, universo/screener debajo. Buscador con el estilo de input del sistema: fondo `#0d1526`, borde `#24344d`, radio 7px, 13px, placeholder `#5b6a80`. El ticker de cada fila es link a `/equity/[ticker]`.

### 4. Detalle de ticker — `/equity/[ticker]`
Archivos: `src/app/equity/[ticker]/page.tsx`, `Fundamentals.tsx`, `Investigacion.tsx`, `Logo.tsx`
Mock: `mocks/Equity ticker rediseño.dc.html` — **la página más trabajada del rediseño; revisar el mock en detalle**

Cambios respecto de la versión actual:
- **Se elimina el sidebar de 340px.** Layout de dos columnas asimétricas con la secundaria bajo el contenido en pantallas angostas.
- **Barra sticky de scroll** con el precio y el nombre, que aparece al bajar. Sirve de referencia permanente mientras se lee.
- **Precio objetivo como barra de rango visual**, no como líneas de texto: mínimo, mediana y máximo de consenso sobre una barra, con el precio actual marcado en su posición relativa. Es el cambio de mayor impacto de la página.
- **Retornos por período** con comparación explícita contra el S&P.

Secciones, en orden (los `id` del mock son los anclajes de la barra sticky):

Columna principal:
1. `#grafico` — "Precio". Header: subtítulo "velas diarias · 12 meses · el rango lo maneja el propio gráfico" + badge outline "TradingView" a la derecha. El cuerpo es el slot del gráfico. **No duplicar los controles de rango de TradingView**: el widget ya los trae. Usar `src/components/GraficoTradingView.tsx` tal cual.
2. `#empresa` — "A qué se dedica", subtítulo "traducido del original de Yahoo". Descripción real de la empresa, alto en la página. Usa `src/lib/traducir.ts`.
3. `#fundamentals` — "Fundamentals", subtítulo "contra la mediana de sus pares". Agrupados por categoría (valuación, rentabilidad, deuda, crecimiento). Leyenda de columnas a la derecha del header en grilla `96px 76px` con micro-labels de 9px. Cada métrica declara su regla de lectura (si más alto es mejor o peor) — esto es contenido, no adorno.
4. `#historia` — "Ventas y márgenes", subtítulo "por año fiscal".
5. `#consenso` — "Resultados vs. consenso", subtítulo "últimos trimestres".
6. `#comparables` — "Comparables del sector", subtítulo con el sector concreto ("las más grandes de semiconductores, por capitalización").

Columna secundaria:
1. `#earnings` — "Próximo earnings", subtítulo "fecha confirmada". Card con acento verde: borde `#1f2c1f`, fondo `linear-gradient(135deg,#0a1a12,#080f1c 70%)`. **Va primero porque condiciona la semana.**
2. `#analistas` — "Analistas", subtítulo con el número de opiniones. Distribución de recomendaciones + barra de precio objetivo.
3. `#noticias` — "Noticias". Lista de titulares con fuente y fecha.

### 5. ETF — `/etf`
Archivos: `src/app/etf/page.tsx`, `EtfClient.tsx`, `TortaSectores.tsx`
Mock: `mocks/ETF rediseño.dc.html`

La torta de sectores usa los acentos `oklch` con hue rotado y luminosidad constante (`oklch(70% 0.11 H)`), nunca colores saturados arbitrarios. Leyenda a un lado con label 11px y porcentaje tabular-nums.

### 6. Glosario — `/glossary`
Archivos: `src/app/glossary/page.tsx`, `GlossaryClient.tsx`, `src/app/api/glossary/*`
Mock: `mocks/Glosario rediseño.dc.html`

Buscador + lista de términos. Definiciones en 13px/1.55 `#94a3b8` con `text-wrap:pretty`.

### 7. Efemérides — `/efemerides`
Archivos: `src/app/efemerides/page.tsx`, `EfemeridesClient.tsx`, `src/lib/efemerides.ts`, `src/components/EfemerideWidget.tsx`
Mock: `mocks/Efemérides rediseño.dc.html`

Sistema de tabs por año. Dos correcciones de lógica, no sólo visuales:
- Los **feriados móviles** deben cargarse por año, no asumirse fijos.
- Los **fines de semana** deben calcularse desde la fecha real (`getDay()`), no estar hardcodeados.

Tab activo: color `#f1f5f9` sobre `#141f33`, radio 7px. Inactivo `#7c8ba1`.

## Interactions & Behavior

- **Nav y cinta sticky**: nav `top:0` `z-index:20`, cinta `top:48px` `z-index:19`. El nav lleva fondo semitransparente; agregar `backdrop-filter: blur(8px)`.
- **Hover de nav item**: fondo `#101a2b`, color `#cbd5e1`. Transición `120ms ease`.
- **Hover de fila de tabla**: fondo `#0b1322`. Sin transición (respuesta inmediata en tablas densas).
- **Hover de card clickeable** (ticker, término de glosario): borde pasa a `#24344d`. Nada más — sin transform ni sombra.
- **Barra sticky del ticker**: aparece al scrollear más allá del bloque de precio. Fade + slide de 8px, `160ms ease-out`. Usar `IntersectionObserver` sobre el header de precio, no listener de scroll.
- **Refresh**: mantener el comportamiento actual de `RefreshButton` / `RefrescarEquity` (server action + `revalidatePath`). El botón muestra el timestamp de última actualización en el nav.
- **CommandPalette** (`src/components/CommandPalette.tsx`): conservar el atajo y comportamiento actuales; reestilar con fondo `#080f1c`, borde `#17233a`, radio 14px, item activo `#141f33`.
- **Responsive**: la grilla `1.55fr 1fr` colapsa a una columna por debajo de ~1100px. La cinta pasa a `overflow-x:auto` con scroll horizontal (celdas `min-width:118px`). En el ticker, la columna secundaria pasa debajo de la principal. No hay diseño móvil dedicado — el objetivo es que no se rompa.
- **Sin animaciones de entrada.** Nada de fade-in de cards ni stagger. Los datos aparecen y ya.

## State Management

Sin state nuevo. El rediseño es de presentación. Lo único a mover:

- **La cinta de indicadores necesita sus datos en el layout**, no en la página. Hoy `src/app/mercado/page.tsx` los pide para sí. Extraer a una función en `src/lib/panel-datos.ts` consumida desde `src/app/layout.tsx`, con cache compartida para no repetir la query en cada navegación.
- **Estado local nuevo**: visibilidad de la barra sticky en `/equity/[ticker]` (`IntersectionObserver`), y año seleccionado en el tab de `/efemerides` (ya existe en `EfemeridesClient`, revisar que la carga de feriados móviles siga el cambio de año).

## Assets

Sin assets nuevos. El logo es un cuadrado con la letra `b` en CSS. Los sparklines y las curvas son SVG generados desde los datos (paths calculados en JS, no archivos). Los SVG en `public/` son los defaults de Next y no se usan.

Fuente: Geist vía Google Fonts. Si el proyecto ya carga Geist con `next/font` (verificar `src/app/layout.tsx`), usar eso en vez del `<link>` — no agregar una segunda carga.

## Files

Mocks en `mocks/`:
- `Dashboard actual.dc.html` — recreación del estado **actual**, como línea de base para comparar
- `Dashboard rediseño.dc.html` — Macro (`/mercado`)
- `Renta fija rediseño.dc.html` — `/renta-fija`
- `Equity rediseño.dc.html` — `/equity`
- `Equity ticker rediseño.dc.html` — `/equity/[ticker]`
- `ETF rediseño.dc.html` — `/etf`
- `Glosario rediseño.dc.html` — `/glossary`
- `Efemérides rediseño.dc.html` — `/efemerides`
- `support.js` — runtime del prototipador. **No portar.** Sólo está para que los mocks abran en el navegador.

Para ver un mock: abrirlo directamente en el navegador. Los links del nav navegan entre mocks.

## Orden de implementación sugerido

1. Tokens en `globals.css` (`@theme` de Tailwind v4) — colores, escala tipográfica, radios.
2. `TopNav` + componente de cinta + subir el fetch de la cinta a `layout.tsx`. Esto ya cambia las 7 páginas.
3. Un componente `Card` (header con punto de acento, título, subtítulo, slot derecho) reutilizado en todas las páginas.
4. `/mercado`.
5. `/equity/[ticker]` — la más larga; la barra de rango de precio objetivo y la barra sticky son piezas nuevas.
6. `/equity`, `/renta-fija`, `/etf`.
7. `/glossary`, `/efemerides` (incluyendo las dos correcciones de lógica de fechas).
