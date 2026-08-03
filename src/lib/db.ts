import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// El bundle de una función serverless es read-only: abrir la DB del repo ahí
// hace fallar cualquier escritura con SQLITE_READONLY (incluido el schema init).
// En Vercel copiamos el snapshot versionado a /tmp — el único directorio
// escribible — y trabajamos sobre esa copia.
export const DB_IS_EPHEMERAL = !!process.env.VERCEL;

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "dashboard.db");
const DB_DIR = DB_IS_EPHEMERAL ? "/tmp/dashboard-db" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "dashboard.db");

/**
 * Deja una copia escribible de la DB en /tmp. La copia vive lo que vive la
 * instancia: en producción los datos nuevos se pierden en el próximo arranque
 * en frío (el mercado se vuelve a bajar de las fuentes, el glosario no).
 */
function ensureWritableDb() {
  if (!DB_IS_EPHEMERAL || fs.existsSync(DB_PATH)) return;
  if (!fs.existsSync(SNAPSHOT_PATH)) return; // sin snapshot: se crea vacía y se seedea

  // El -shm se reconstruye solo a partir del -wal; copiarlo desactualizado rompe.
  fs.copyFileSync(SNAPSHOT_PATH, DB_PATH);
  if (fs.existsSync(SNAPSHOT_PATH + "-wal")) {
    fs.copyFileSync(SNAPSHOT_PATH + "-wal", DB_PATH + "-wal");
  }
}

declare global {
  var __db: Database.Database | undefined;
}

function initSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary_terms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      term        TEXT    NOT NULL UNIQUE,
      category    TEXT    NOT NULL,
      short_def   TEXT    NOT NULL,
      detail      TEXT    NOT NULL,
      example     TEXT    NOT NULL,
      ticker      TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_glossary_category ON glossary_terms(category);

    -- ── Mercado ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS market_instruments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker     TEXT    NOT NULL UNIQUE,
      nombre     TEXT    NOT NULL,
      tipo       TEXT    NOT NULL CHECK(tipo IN ('soberano_usd','lecap','cer','on','cedear','fx','tasa','macro')),
      moneda     TEXT    NOT NULL DEFAULT 'ARS' CHECK(moneda IN ('ARS','USD')),
      ley        TEXT    CHECK(ley IN ('AR','NY')),
      unidad     TEXT    NOT NULL DEFAULT 'ARS' CHECK(unidad IN ('ARS','USD','%','pb','musd','mars','idx')),
      grupo      TEXT    NOT NULL DEFAULT 'riesgo',
      activo     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Serie temporal genérica: una tabla para todo indicador/métrica.
    -- instrumento referencia market_instruments.ticker pero sin FK: permite
    -- ingestar series de instrumentos aún no registrados y sumar métricas sin migrar.
    CREATE TABLE IF NOT EXISTS market_series (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha       TEXT    NOT NULL,
      instrumento TEXT    NOT NULL,
      metrica     TEXT    NOT NULL,
      valor       REAL    NOT NULL,
      fuente      TEXT    NOT NULL DEFAULT 'manual',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(fecha, instrumento, metrica)
    );
    CREATE INDEX IF NOT EXISTS idx_market_series_lookup ON market_series(instrumento, metrica, fecha);

    -- Cashflows por bono, carga manual única (cupón + amortización por 100 VN).
    CREATE TABLE IF NOT EXISTS market_cashflows (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker       TEXT NOT NULL,
      fecha_pago   TEXT NOT NULL,
      cupon        REAL NOT NULL DEFAULT 0,
      amortizacion REAL NOT NULL DEFAULT 0,
      UNIQUE(ticker, fecha_pago)
    );
    CREATE INDEX IF NOT EXISTS idx_market_cashflows_ticker ON market_cashflows(ticker);

    -- Bitácora diaria: lectura propia + snapshot de indicadores de esa fecha.
    CREATE TABLE IF NOT EXISTS market_journal (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha         TEXT NOT NULL UNIQUE,
      texto         TEXT NOT NULL,
      snapshot_json TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migración jul-2026: el dashboard dejó de ser de facultad (pivot a asesor
  // financiero). Backup previo en data/backup-pre-balanz-2026-07-31.db.
  db.exec(`
    DROP TABLE IF EXISTS habit_logs;
    DROP TABLE IF EXISTS habits;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS study_sessions;
    DROP TABLE IF EXISTS class_materials;
    DROP TABLE IF EXISTS exams;
    DROP TABLE IF EXISTS classes;
    DROP TABLE IF EXISTS subjects;
    DROP TABLE IF EXISTS semesters;
    DROP TABLE IF EXISTS transactions;
  `);

  // Glossary migrations (instalaciones previas)
  try { db.exec("ALTER TABLE glossary_terms ADD COLUMN term_type TEXT NOT NULL DEFAULT 'concepto'"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE glossary_terms ADD COLUMN formula TEXT"); } catch { /* exists */ }

  // Migración jul-2026: unidades nuevas (musd/mars/idx) en el CHECK + columna grupo.
  // SQLite no permite alterar CHECKs: rebuild de la tabla si el DDL viejo no las tiene.
  const ddl = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='market_instruments'")
    .get() as { sql: string } | undefined;
  if (ddl && !ddl.sql.includes("'idx'")) {
    const tieneGrupo = ddl.sql.includes("grupo");
    db.exec(`
      ALTER TABLE market_instruments RENAME TO market_instruments_old;
      CREATE TABLE market_instruments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker     TEXT    NOT NULL UNIQUE,
        nombre     TEXT    NOT NULL,
        tipo       TEXT    NOT NULL CHECK(tipo IN ('soberano_usd','lecap','cer','on','cedear','fx','tasa','macro')),
        moneda     TEXT    NOT NULL DEFAULT 'ARS' CHECK(moneda IN ('ARS','USD')),
        ley        TEXT    CHECK(ley IN ('AR','NY')),
        unidad     TEXT    NOT NULL DEFAULT 'ARS' CHECK(unidad IN ('ARS','USD','%','pb','musd','mars','idx')),
        grupo      TEXT    NOT NULL DEFAULT 'riesgo',
        activo     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO market_instruments (id, ticker, nombre, tipo, moneda, ley, unidad, grupo, activo, created_at)
        SELECT id, ticker, nombre, tipo, moneda, ley, unidad,
               ${tieneGrupo ? "grupo" : "'riesgo'"}, activo, created_at
        FROM market_instruments_old;
      DROP TABLE market_instruments_old;
    `);
  }
}

function seedGlossary(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM glossary_terms").get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(
    "INSERT OR IGNORE INTO glossary_terms (term, category, short_def, detail, example, ticker) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const terms: [string, string, string, string, string, string | null][] = [
    // ── Renta Fija ──────────────────────────────────────────────────────────
    ["Duration", "Renta Fija",
      "Sensibilidad del precio de un bono ante cambios en la tasa de interés.",
      "La Duration de Macaulay es el promedio ponderado de los plazos de los flujos de caja. La Modified Duration expresa el cambio porcentual en precio ante una variación del 1% en la tasa.",
      "Un bono con Modified Duration 4,5 baja ~4,5% si la TNA sube 100 bps.",
      null],

    ["Convexidad", "Renta Fija",
      "Curvatura de la relación precio-tasa; corrige el error lineal de la Duration.",
      "La convexidad mide cuánto se curva la función precio-tasa. Bonos con mayor convexidad ganan más cuando bajan tasas y pierden menos cuando suben.",
      "Si la tasa baja 200 bps, la suba de precio supera la predicción de la Duration por efecto de la convexidad.",
      null],

    ["Bootstrapping", "Renta Fija",
      "Técnica para extraer tasas spot a partir de precios de bonos cupón corriente.",
      "Se parte de la tasa de corto plazo y se avanza iterativamente hacia plazos más largos, eliminando el efecto cupón de cada bono para obtener las tasas cero cupón puras.",
      "Con un bono a 1 año que paga cupón y otro a 2 años, se obtiene la tasa spot a 2 años despejando de su precio.",
      null],

    ["Curva spot", "Renta Fija",
      "Tasa de descuento de un único flujo en cada plazo (tasa cero cupón).",
      "Cada punto de la curva spot es la TIR de un bono cero cupón hipotético a ese plazo. Es la curva fundamental para descontar correctamente flujos individuales.",
      "La tasa spot a 3 años indica a qué tasa anual un peso recibido en 3 años equivale a uno hoy.",
      null],

    ["Curva par", "Renta Fija",
      "Tasas a las que un bono con cupón periódico se cotizaría a la par (precio 100).",
      "Se construye a partir de la curva spot. Si la curva par está por encima de la spot en todos los plazos, la curva es normal (pendiente positiva).",
      "Una tasa par a 5 años del 8% implica que un bono que paga 8% anual se cotiza a 100.",
      null],

    ["Curva forward", "Renta Fija",
      "Tasa implícita en la curva spot para un período futuro específico.",
      "La tasa forward entre t1 y t2 se extrae de las tasas spot: (1+s₂)^t2 = (1+s₁)^t1 × (1+f₁₂)^(t2-t1). Refleja la expectativa de tasas futuras.",
      "Si la spot a 1Y es 5% y a 2Y es 6%, la forward 1Y×2Y es aproximadamente 7%.",
      null],

    ["YTM", "Renta Fija",
      "Yield To Maturity: tasa interna de retorno de un bono si se mantiene hasta el vencimiento.",
      "Es la tasa de descuento que iguala el precio sucio del bono con el valor presente de todos sus flujos futuros (cupones + amortización). Asume reinversión de cupones a esa misma tasa.",
      "AL35 a 64 dólares con pagos semestrales tiene una YTM cercana al 14% anual en USD.",
      "AL35.BA"],

    ["TIR", "Renta Fija",
      "Tasa Interna de Retorno: tasa que iguala el valor presente de flujos con la inversión inicial.",
      "En bonos es equivalente al YTM. En proyectos es la tasa que hace el VAN igual a cero. Se usa para comparar alternativas de inversión.",
      "Un proyecto que requiere $100 hoy y devuelve $121 en 2 años tiene una TIR del 10% anual.",
      null],

    ["Precio limpio vs sucio", "Renta Fija",
      "El precio sucio incluye el cupón corrido; el precio limpio no.",
      "Los bonos se cotizan a precio limpio (flat price) pero se liquidan a precio sucio (full price = limpio + cupón corrido). El cupón corrido es la fracción del cupón acumulada desde el último pago.",
      "Un bono cotiza a 95 (limpio) con 1,5 de cupón corrido: se pagan 96,5 (sucio) al liquidar.",
      null],

    ["Amortización francesa", "Renta Fija",
      "Sistema de cuota fija donde la proporción de capital aumenta y la de interés disminuye.",
      "Cada período se paga la misma cuota total, pero el desglose varía: más interés al inicio, más capital al final. La cuota se calcula como C = VN × r / (1-(1+r)^-n).",
      "Un préstamo de $100.000 a 12 meses al 5% mensual tiene la misma cuota todos los meses, pero en el primer mes paga más interés que en el último.",
      null],

    ["LECAP", "Renta Fija",
      "Letra del Tesoro en pesos a descuento; tasa fija en moneda local.",
      "Son letras emitidas por el Tesoro Nacional con descuento inicial. La ganancia es la diferencia entre el precio de compra y el valor nominal al vencimiento. Plazos cortos (1-12 meses).",
      "Una LECAP a 90 días comprada a $95 y que vence a $100 rinde ~21% TNA.",
      null],

    ["BONCER", "Renta Fija",
      "Bono del Tesoro ajustado por CER (inflación) con cupón real fijo.",
      "El capital se ajusta diariamente por el índice CER (correlacionado con el IPC). Ofrece rendimiento real positivo sobre inflación, protegiendo contra la erosión del poder adquisitivo.",
      "Un BONCER con cupón real del 2% rinde inflación + 2% anual.",
      null],

    ["BOPREAL", "Renta Fija",
      "Bono para la Reconstrucción de una Argentina Libre; emitido por el BCRA en 2024.",
      "Creado para regularizar deudas comerciales en dólares con importadores. Permite a empresas deudoras cancelar sus pasivos en dólares a cambio de estos bonos, que luego pueden negociarse.",
      "Una empresa con deuda comercial de USD 1M puede suscribir BOPREAL y cancelar esa deuda.",
      null],

    ["AL35", "Renta Fija",
      "Bonar 2035: bono soberano en USD bajo ley argentina con vencimiento en 2035.",
      "Emitido tras el canje de deuda de 2020. Paga cupones semestrales en USD y amortiza capital en cuotas. Se liquida en pesos al tipo de cambio oficial (T+1 en el mercado local).",
      "AL35 cotiza en el mercado local en pesos; al dividir por el CCL implícito se obtiene su precio en USD.",
      "AL35.BA"],

    ["GD35", "Renta Fija",
      "Global 2035: bono soberano en USD bajo ley de Nueva York con vencimiento en 2035.",
      "Similar al AL35 pero con jurisdicción NY, lo que ofrece mayor protección legal al tenedor. Cotiza en Euroclear y se negocia en el exterior directamente en USD.",
      "El spread AL35-GD35 refleja la prima de riesgo legal argentina vs NY.",
      "GD35.BA"],

    ["ON (Obligación Negociable)", "Renta Fija",
      "Bono corporativo emitido por empresas privadas para financiarse en el mercado de capitales.",
      "Las ON pueden estar en USD, pesos o indexadas a CER/UVA. Ofrecen mayor rendimiento que soberanos por riesgo corporativo. Pueden ser hard dollar (pagan en USD) o dollar linked.",
      "YPF emite una ON hard dollar al 8,5% anual con vencimiento a 5 años.",
      null],

    ["LETE", "Renta Fija",
      "Letra del Tesoro en dólares; instrumento de corto plazo en moneda extranjera.",
      "Letras del Tesoro emitidas en USD con descuento. Son instrumentos de liquidez para el Tesoro y de inversión en moneda dura a corto plazo.",
      "Una LETE a 180 días cotiza a USD 97 y vence a USD 100, rindiendo ~6% TNA en USD.",
      null],

    ["LECER", "Renta Fija",
      "Letra del Tesoro ajustada por CER; instrumento de corto plazo en pesos reales.",
      "Similar a las LECAP pero con capital ajustado por inflación (CER). Protegen contra la inflación en plazos cortos y son la referencia de la curva CER en el tramo corto.",
      "Una LECER a 3 meses con tasa real de 0% rinde exactamente inflación en ese período.",
      null],

    // ── Renta Variable ──────────────────────────────────────────────────────
    ["P/E", "Renta Variable",
      "Price-to-Earnings: precio de la acción dividido por la ganancia por acción.",
      "Indica cuántos años de ganancias actuales se pagan por la acción. Un P/E alto puede reflejar expectativas de crecimiento futuro o sobrevaluación. Se compara contra el sector y la historia.",
      "Si GGAL cotiza a $1.000 y su EPS es $100, su P/E es 10x. El sector en LATAM promedia 8x.",
      "GGAL.BA"],

    ["EV/EBITDA", "Renta Variable",
      "Enterprise Value sobre EBITDA: múltiplo de valoración independiente de la estructura de capital.",
      "EV = Market Cap + Deuda Neta. Al dividir por EBITDA se obtiene cuántos años de generación operativa se pagan. Es menos sensible a diferencias contables entre países.",
      "YPF con EV de $5.000M y EBITDA de $1.000M tiene un múltiplo de 5x EV/EBITDA.",
      "YPFD.BA"],

    ["DCF", "Renta Variable",
      "Discounted Cash Flow: método de valoración que descuenta flujos de caja futuros proyectados.",
      "Se proyectan los Free Cash Flows futuros y se descuentan al WACC. El valor terminal representa el valor de los flujos más allá del período de proyección explícita.",
      "Una empresa que genera $100M anuales creciendo al 3%, descontado al 10%, vale $100M/(10%-3%) = $1.428M.",
      null],

    ["WACC", "Renta Variable",
      "Weighted Average Cost of Capital: costo promedio ponderado del capital de una empresa.",
      "Combina el costo del equity (CAPM) y el costo de la deuda después de impuestos, ponderados por su participación en el financiamiento total. Es la tasa de descuento en un DCF.",
      "Con 60% equity a 15% y 40% deuda a 8% (tasa efectiva 5,6% post-tax), el WACC = 60%×15% + 40%×5,6% = 11,24%.",
      null],

    ["Beta", "Renta Variable",
      "Sensibilidad del retorno de una acción respecto al retorno del mercado.",
      "Beta = 1: se mueve igual que el mercado. Beta > 1: más volátil. Beta < 1: defensivo. Beta < 0: se mueve en contra del mercado. Se estima por regresión histórica.",
      "GGAL con Beta 1,4 sube 14% cuando el Merval sube 10%, y baja 14% cuando el Merval baja 10%.",
      null],

    ["ROE", "Renta Variable",
      "Return on Equity: rentabilidad sobre el patrimonio neto de los accionistas.",
      "ROE = Ganancia Neta / Patrimonio Neto. Mide la eficiencia con la que la empresa usa el capital aportado por los accionistas. Se puede descomponer por DuPont en margen, rotación y apalancamiento.",
      "Banco Galicia con ganancia de $50.000M y PN de $200.000M tiene un ROE del 25%.",
      null],

    ["ROA", "Renta Variable",
      "Return on Assets: rentabilidad sobre los activos totales de la empresa.",
      "ROA = Ganancia Neta / Activos Totales. Mide qué tan eficientemente la empresa usa todos sus recursos para generar ganancias, independientemente de cómo se financian.",
      "Una empresa con activos de $1.000M y ganancia de $80M tiene un ROA del 8%.",
      null],

    ["Free float", "Renta Variable",
      "Porcentaje de acciones de una empresa que se negocian libremente en el mercado.",
      "Excluye acciones en manos de controlantes, directivos e inversores estratégicos. Un free float bajo implica menor liquidez y mayor volatilidad ante movimientos de grandes inversores.",
      "Si YPF tiene 51% del Estado y 15% de accionistas controlantes, el free float es 34%.",
      "YPFD.BA"],

    ["Dividend yield", "Renta Variable",
      "Dividendo anual por acción dividido por el precio de mercado de la acción.",
      "Mide el retorno por dividendos sobre el precio pagado. Empresas maduras en sectores defensivos suelen tener alto dividend yield. No incluye la ganancia de capital.",
      "Una acción a $500 que paga $25 anuales en dividendos tiene un dividend yield del 5%.",
      null],

    ["CEDEAR", "Renta Variable",
      "Certificado de Depósito Argentino que representa acciones extranjeras cotizadas en Argentina.",
      "Cada CEDEAR representa una fracción de una acción global (ratio de conversión variable). Cotizan en pesos pero están dolarizados al CCL implícito, funcionando como cobertura cambiaria.",
      "AAPL CEDEAR (ratio 10:1): 10 CEDEARs equivalen a 1 acción de Apple. Si AAPL sube 5% en USD, el CEDEAR sube ~5% más la variación del CCL.",
      null],

    // ── Derivados ───────────────────────────────────────────────────────────
    ["Call", "Derivados",
      "Opción que da el derecho (no la obligación) de comprar el activo subyacente a precio strike.",
      "El comprador de un call paga una prima y tiene upside ilimitado. El vendedor cobra la prima pero asume riesgo ilimitado. El call está in-the-money si el precio spot supera al strike.",
      "Call GGAL strike $1.200 con prima $50: si GGAL sube a $1.400, el comprador gana $150 neto de prima.",
      null],

    ["Put", "Derivados",
      "Opción que da el derecho (no la obligación) de vender el activo subyacente a precio strike.",
      "El comprador de un put paga una prima y gana cuando el subyacente baja por debajo del strike. Funciona como seguro de cartera. El put está in-the-money si el precio spot cae por debajo del strike.",
      "Put AL35 strike $60 con prima $3: si AL35 cae a $50, el comprador gana $7 neto de prima.",
      null],

    ["Greeks (Delta, Gamma, Theta, Vega)", "Derivados",
      "Métricas de sensibilidad de una opción ante cambios en variables de mercado.",
      "Delta: cambio en precio de la opción por $1 de cambio en el subyacente (0 a 1 para calls). Gamma: tasa de cambio del Delta. Theta: pérdida de valor por el paso del tiempo (time decay). Vega: sensibilidad ante cambios en volatilidad implícita.",
      "Una opción con Delta 0,5 sube $0,50 si el subyacente sube $1. Con Theta -$2 pierde $2 por día que pasa.",
      null],

    ["Volatilidad implícita", "Derivados",
      "Volatilidad que, introducida en el modelo de Black-Scholes, reproduce el precio de mercado de una opción.",
      "Es la volatilidad que el mercado 'espera' en el futuro, extraída del precio de la opción. No es la volatilidad histórica realizada. Sube en momentos de incertidumbre o previo a eventos importantes.",
      "Si el VIX (volatilidad implícita del S&P 500) supera 30, el mercado descuenta alta turbulencia.",
      null],

    ["Smile de volatilidad", "Derivados",
      "Patrón donde la volatilidad implícita varía según el strike de las opciones.",
      "Black-Scholes asume volatilidad constante, pero el mercado muestra que opciones out-of-the-money tienen mayor vol implícita. Refleja la demanda de protección ante caídas extremas (tail risk).",
      "Para opciones sobre el S&P 500, los puts OTM tienen mayor vol implícita que las ATM, generando el 'skew'.",
      null],

    ["Superficie de volatilidad", "Derivados",
      "Extensión 3D del smile: volatilidad implícita en función de strike y vencimiento.",
      "Cada punto de la superficie representa la vol implícita para un par (strike, vencimiento). Permite valorar cualquier opción vainilla e identificar oportunidades de arbitraje.",
      "Una superficie plana indicaría que el mercado no diferencia riesgo por plazo ni por moneyness.",
      null],

    ["Futuros", "Derivados",
      "Contratos estandarizados de compraventa futura de un activo a un precio y fecha fijados hoy.",
      "Se negocian en mercados organizados (ROFEX en Argentina). Requieren margin calls diarios. No hay pago inicial del principal. Precio futuro = Spot × (1 + costo de financiamiento - dividendos).",
      "Futuro de dólar ROFEX a 30 días a $1.100: si el spot llega a $1.150, el comprador gana $50 por contrato.",
      null],

    ["Forward", "Derivados",
      "Contrato OTC de compraventa futura similar al futuro pero no estandarizado.",
      "Se acuerda entre dos partes, con términos a medida (monto, fecha, precio). No hay liquidación diaria de márgenes. Riesgo de contraparte más alto que los futuros.",
      "Una exportadora acuerda un forward a 90 días para vender USD 1M a $1.050, asegurando su ingreso en pesos.",
      null],

    ["Swap", "Derivados",
      "Acuerdo para intercambiar flujos de caja entre dos partes en fechas futuras.",
      "El más común es el interest rate swap (IRS): una parte paga tasa fija y recibe tasa variable (BADLAR). Permite transformar perfiles de riesgo sin modificar el balance.",
      "Un banco con pasivos a tasa variable entra en un swap pagando fijo y recibiendo BADLAR para cubrirse.",
      null],

    ["Caución bursátil", "Derivados",
      "Operación de pase en el mercado de capitales argentino equivalente a un repo a corto plazo.",
      "El tomador entrega títulos como garantía y recibe fondos, comprometiéndose a recomprar los títulos al vencimiento. El colocador presta fondos a cambio de los títulos. La tasa de caución es el costo/rendimiento.",
      "Un fondo colocador presta $1M a tasa de caución 70% TNA por 7 días, garantizado con bonos.",
      null],

    // ── Tasas & Curvas ──────────────────────────────────────────────────────
    ["BADLAR", "Tasas & Curvas",
      "Buenos Aires Deposits of Large Amount Rate: tasa de depósitos mayoristas a 30 días.",
      "Es la tasa promedio que pagan los bancos privados por depósitos a plazo fijo de más de $1M a 30-35 días. Referencia para contratos y bonos a tasa variable en pesos.",
      "Si la BADLAR es 97% TNA, un fondo money market que rinde BADLAR + 2% rinde ~99% TNA.",
      null],

    ["Tasa política monetaria", "Tasas & Curvas",
      "Tasa de referencia fijada por el BCRA para regular la liquidez del sistema financiero.",
      "El BCRA la usa como ancla de la política monetaria. Afecta el costo del crédito, los plazos fijos y la brecha cambiaria. Desde 2024 es la tasa de pases pasivos a 1 día.",
      "Con tasa de política al 60% TNA, un plazo fijo a 30 días rinde aproximadamente 4,9% mensual.",
      null],

    ["Tasa real vs nominal", "Tasas & Curvas",
      "La tasa nominal no ajusta por inflación; la real sí.",
      "Tasa real ≈ Tasa nominal - Inflación (Fisher exacto: (1+r_real) = (1+r_nom)/(1+π)). Una tasa nominal alta con inflación mayor implica tasa real negativa.",
      "TNA 100% con inflación 120% anual: tasa real = (1+1)/(1+1,2) - 1 ≈ -9% (negativa).",
      null],

    ["Spread", "Tasas & Curvas",
      "Diferencial de rendimiento entre dos instrumentos o tasas de referencia.",
      "Puede ser Z-spread (spread constante sobre curva libre de riesgo), OAS (spread ajustado por opciones) o simplemente la diferencia entre YTMs de dos bonos.",
      "GD35 rinde 14% y el US Treasury a 10Y rinde 4,5%; el spread soberano es ~950 bps.",
      null],

    ["CER", "Tasas & Curvas",
      "Coeficiente de Estabilización de Referencia: índice de actualización por inflación del BCRA.",
      "Se publica diariamente con un rezago de ~45 días respecto al IPC. Se usa para ajustar el capital de instrumentos CER (BONCER, LECER, préstamos UVA). Acumula la inflación del período.",
      "Si el CER sube 8% en un mes, el capital de un BONCER sube 8%, manteniendo el poder adquisitivo.",
      null],

    ["Tasa libre de riesgo", "Tasas & Curvas",
      "Rendimiento de un activo sin riesgo de default; referencia para calcular primas de riesgo.",
      "En teoría es el retorno de un bono soberano del país emisor de la moneda de referencia. En USD se usa la curva del Tesoro de EE.UU. (T-bills, T-bonds). En Argentina hay debate sobre cuál usar.",
      "Si la T-bill a 3 meses rinde 5,2% y el CAPM exige 8% de prima de riesgo, el costo del equity mínimo es 13,2%.",
      null],

    // ── Instrumentos AR ─────────────────────────────────────────────────────
    ["AO27", "Instrumentos AR",
      "Bono del Tesoro en USD con vencimiento en julio de 2027, ley argentina.",
      "Bono dolarizado emitido por el Tesoro Nacional. Paga cupones semestrales en USD y amortiza al vencimiento. Liquidación en pesos al tipo de cambio oficial en el mercado local.",
      "AO27 a precio USD 95 con cupón del 3,5% anual tiene una YTM aproximada del 6% en USD.",
      "AO27.BA"],

    ["AO28", "Instrumentos AR",
      "Bono del Tesoro en USD con vencimiento en 2028, ley argentina.",
      "Similar al AO27 pero con mayor plazo y YTM. Parte de la curva soberana en USD ley local. Referencia para comparar con los Globales de plazo similar.",
      "El spread AO28-GD29 refleja la prima de ley argentina versus Nueva York.",
      "AO28.BA"],

    // ── Macro Argentina ─────────────────────────────────────────────────────
    ["Brecha cambiaria", "Macro Argentina",
      "Diferencia porcentual entre el tipo de cambio libre (CCL o blue) y el oficial.",
      "Una brecha alta incentiva la subfacturación de exportaciones y la sobrefacturación de importaciones. Distorsiona el comercio exterior y genera presiones devaluatorias acumuladas.",
      "Con dólar oficial $1.000 y CCL $1.400, la brecha es del 40%.",
      null],

    ["Dólar MEP", "Macro Argentina",
      "Dólar Mercado Electrónico de Pagos: tipo de cambio implícito en la compraventa de bonos.",
      "Se compra un bono en pesos (AL30, GD30) y se vende la misma especie en USD en el mismo mercado local. El cociente pesos/USD es el tipo de cambio MEP. Es legal y no requiere MULC.",
      "Comprando AL30 a $75.000 y vendiéndolo en USD a USD 55, el MEP implícito es $1.363.",
      null],

    ["CCL", "Macro Argentina",
      "Contado con Liquidación: tipo de cambio libre obtenido via compraventa de activos en distintas plazas.",
      "Se compra un activo en Argentina (pesos) y se vende en el exterior (USD). A diferencia del MEP, el pago se liquida en el exterior. Es el tipo de cambio relevante para CEDEARs y fugas de capital.",
      "GD30 en pesos a $85.000 y en USD a USD 60 en NYSE implica CCL de $1.416.",
      null],

    ["MULC", "Macro Argentina",
      "Mercado Único y Libre de Cambios: mercado oficial donde opera el BCRA.",
      "Es el mercado cambiario regulado donde se transan exportaciones, importaciones y deuda. El BCRA interviene fijando el tipo de cambio oficial (o deslizando el crawling peg). Las regulaciones se llaman cepo cambiario.",
      "Las exportaciones de soja deben liquidarse en el MULC al tipo de cambio oficial.",
      null],

    ["Reservas brutas vs netas", "Macro Argentina",
      "Las reservas brutas incluyen todos los activos externos del BCRA; las netas excluyen pasivos.",
      "Reservas netas = brutas menos encajes bancarios en USD, swap con China, SEDESA y otros pasivos. Son el indicador relevante de la capacidad de intervención del BCRA.",
      "Con reservas brutas USD 27.000M y pasivos exigibles de USD 20.000M, las netas son solo USD 7.000M.",
      null],

    ["Base monetaria", "Macro Argentina",
      "Agregado monetario primario: billetes en circulación más reservas bancarias en el BCRA.",
      "Es el pasivo monetario del BCRA. Su expansión puede generar inflación si supera la demanda de dinero. Se amplía cuando el BCRA emite para financiar al Tesoro o comprar divisas.",
      "Una base monetaria que crece al 120% anual cuando la demanda de dinero cae presiona al alza el nivel de precios.",
      null],

    ["Leliq", "Macro Argentina",
      "Letras de Liquidez del BCRA: instrumento de esterilización monetaria a 28 días.",
      "El BCRA las emite para absorber pesos excedentes del sistema. Los bancos las compran con los depósitos de sus clientes. El stock de Leliqs implica una deuda remunerada del BCRA que representa pasivos cuasi-fiscales.",
      "Con $20 billones en Leliqs al 97% TNA, el BCRA paga intereses que retroalimentan la emisión.",
      null],

    ["Pases pasivos", "Macro Argentina",
      "Operaciones repo de cortísimo plazo (1 día) entre el BCRA y los bancos.",
      "Desde 2024 reemplazaron a las Leliqs como principal instrumento de esterilización. Los bancos depositan pesos overnight en el BCRA a cambio de una tasa. Son la tasa de política monetaria de referencia.",
      "Con pases pasivos al 60% TNA, los bancos depositan excedentes en el BCRA ganando ~4,9% mensual.",
      null],
  ];

  const insertMany = db.transaction((rows: typeof terms) => {
    for (const row of rows) ins.run(...row);
  });
  insertMany(terms);
}

function seedMercado(db: Database.Database) {
  // El seed es la fuente de verdad de los metadatos de presentación de los
  // instrumentos permanentes: corre en cada boot y actualiza nombre/unidad/grupo
  // de los que ya existen (sin tocar `activo`, que el usuario controla).
  // Lecaps/Boncaps y CER vigentes rotan por vencimiento: se agregan desde la UI.
  const ins = db.prepare(
    `INSERT INTO market_instruments (ticker, nombre, tipo, moneda, ley, unidad, grupo)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       nombre = excluded.nombre,
       unidad = excluded.unidad,
       grupo  = excluded.grupo`
  );
  const rows: [string, string, string, string, string | null, string, string][] = [
    // ── Soberanos hard-dollar ──────────────────────────────────────────────
    ["GD29", "Global 2029", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["GD30", "Global 2030", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["GD35", "Global 2035", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["GD38", "Global 2038", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["GD41", "Global 2041", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["GD46", "Global 2046", "soberano_usd", "USD", "NY", "USD", "soberanos"],
    ["AL29", "Bonar 2029", "soberano_usd", "USD", "AR", "USD", "soberanos"],
    ["AL30", "Bonar 2030", "soberano_usd", "USD", "AR", "USD", "soberanos"],
    ["AL35", "Bonar 2035", "soberano_usd", "USD", "AR", "USD", "soberanos"],
    ["AE38", "Bonar 2038", "soberano_usd", "USD", "AR", "USD", "soberanos"],
    ["AL41", "Bonar 2041", "soberano_usd", "USD", "AR", "USD", "soberanos"],

    // ── Dólar (todo en ARS) ────────────────────────────────────────────────
    ["OFICIAL",   "Dólar oficial",    "fx", "ARS", null, "ARS", "fx"],
    ["MAYORISTA", "Dólar mayorista",  "fx", "ARS", null, "ARS", "fx"],
    ["MEP",       "Dólar MEP",        "fx", "ARS", null, "ARS", "fx"],
    ["CCL",       "Dólar CCL",        "fx", "ARS", null, "ARS", "fx"],
    ["BLUE",      "Dólar blue",       "fx", "ARS", null, "ARS", "fx"],

    // ── Tasas en pesos (TNA) ───────────────────────────────────────────────
    // La TPM dejó de publicarse (jul-2025); TAMAR y BADLAR son la referencia.
    ["TAMAR",     "TAMAR bancos privados", "tasa", "ARS", null, "%", "tasas_ars"],
    ["BADLAR",    "BADLAR bancos privados", "tasa", "ARS", null, "%", "tasas_ars"],
    ["PLAZOFIJO", "Plazo fijo minorista",   "tasa", "ARS", null, "%", "tasas_ars"],
    ["CAUCION1",  "Caución 1 día",          "tasa", "ARS", null, "%", "tasas_ars"],

    // ── Inflación (pesos) ──────────────────────────────────────────────────
    ["IPC",     "IPC mensual",     "macro", "ARS", null, "%",   "inflacion"],
    ["IPC_IA",  "IPC interanual",  "macro", "ARS", null, "%",   "inflacion"],
    ["UVA",     "UVA",             "macro", "ARS", null, "idx", "inflacion"],

    // ── Riesgo & reservas ──────────────────────────────────────────────────
    ["RIESGO_PAIS", "Riesgo país (EMBI)", "macro", "USD", null, "pb",   "riesgo"],
    ["RESERVAS",    "Reservas BCRA",      "macro", "USD", null, "musd", "riesgo"],
    ["BASE_MON",    "Base monetaria",     "macro", "ARS", null, "mars", "riesgo"],

    // ── Global (todo en USD) ───────────────────────────────────────────────
    ["UST10Y", "UST 10 años",       "macro", "USD", null, "%",   "global"],
    ["SPX",    "S&P 500",           "macro", "USD", null, "idx", "global"],
    ["DXY",    "Índice dólar DXY",  "macro", "USD", null, "idx", "global"],
    ["BRL",    "Real brasileño",    "macro", "USD", null, "idx", "global"],

    // ── Commodities (USD) — el agro y la energía definen la oferta de dólares
    ["SOJA",     "Soja (bushel)",     "macro", "USD", null, "USD", "commodities"],
    ["PETROLEO", "Petróleo Brent",    "macro", "USD", null, "USD", "commodities"],
    ["ORO",      "Oro (onza)",        "macro", "USD", null, "USD", "commodities"],

    // ── Acciones Argentina ─────────────────────────────────────────────────
    // Merval en USD no se seedea: se deriva de MERVAL/CCL al leer (ver page.tsx)
    ["MERVAL", "Merval", "macro", "ARS", null, "idx", "acciones"],
  ];

  const insertMany = db.transaction((items: typeof rows) => {
    for (const row of items) ins.run(...row);
  });
  insertMany(rows);

  // Backfill de grupo para filas creadas antes de que existiera la columna
  db.exec(`
    UPDATE market_instruments SET grupo = CASE
      WHEN tipo = 'soberano_usd' THEN 'soberanos'
      WHEN tipo IN ('lecap','cer') THEN 'pesos'
      WHEN tipo IN ('on','cedear') THEN 'corp'
      WHEN tipo = 'fx' THEN 'fx'
      WHEN tipo = 'tasa' THEN 'tasas_ars'
      ELSE 'riesgo' END
    WHERE grupo IS NULL OR grupo = '';
  `);

  // La TPM ya no existe como serie del BCRA: ocultarla si nunca juntó datos.
  db.exec(`
    UPDATE market_instruments SET activo = 0
    WHERE ticker = 'TPM'
      AND NOT EXISTS (SELECT 1 FROM market_series WHERE instrumento = 'TPM')
  `);
}

export function getDb(): Database.Database {
  if (!global.__db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    ensureWritableDb();
    global.__db = new Database(DB_PATH);
    initSchema(global.__db);
    seedGlossary(global.__db);
    seedMercado(global.__db);
  }
  return global.__db;
}
