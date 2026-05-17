import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { localDateStr } from "@/lib/utils";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "dashboard.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function initSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Core tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      short      TEXT    NOT NULL,
      hue        INTEGER NOT NULL DEFAULT 220,
      credits    INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS classes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      week        INTEGER NOT NULL DEFAULT 1,
      title       TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      summarized  INTEGER NOT NULL DEFAULT 0,
      summary     TEXT,
      tasks_total INTEGER NOT NULL DEFAULT 0,
      tasks_done  INTEGER NOT NULL DEFAULT 0,
      is_new      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      type        TEXT    NOT NULL DEFAULT 'parcial' CHECK(type IN ('parcial', 'tp', 'final', 'quiz')),
      date        TEXT    NOT NULL,
      grade       REAL,
      weight      REAL    NOT NULL DEFAULT 0.5
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      context      TEXT    NOT NULL DEFAULT 'facultad',
      priority     TEXT    NOT NULL DEFAULT 'media' CHECK(priority IN ('alta', 'media', 'baja')),
      due_date     TEXT,
      subject_id   INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      material_id  INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      status       TEXT    NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'hecha')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS habits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date      TEXT    NOT NULL,
      UNIQUE(habit_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_subject    ON tasks(subject_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_material   ON tasks(material_id);
    CREATE INDEX IF NOT EXISTS idx_classes_subject  ON classes(subject_id);
    CREATE INDEX IF NOT EXISTS idx_exams_subject    ON exams(subject_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date  ON habit_logs(date);

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
  `);

  // Migrations for existing installs
  try { db.exec("ALTER TABLE tasks ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE tasks ADD COLUMN material_id INTEGER REFERENCES classes(id) ON DELETE SET NULL"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE tasks DROP COLUMN context"); } catch { /* exists or unsupported */ }

  // Remove stale non-faculty data
  try { db.exec("DELETE FROM tasks WHERE context IS NOT NULL AND context != 'facultad'"); } catch { /* no column */ }
  try { db.exec("DELETE FROM tasks WHERE title LIKE '%arancel%'"); } catch { /* ok */ }

  // Glossary migrations
  try { db.exec("ALTER TABLE glossary_terms ADD COLUMN term_type TEXT NOT NULL DEFAULT 'concepto'"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE glossary_terms ADD COLUMN formula TEXT"); } catch { /* exists */ }
}

function seedData(db: Database.Database) {
  const subjectCount = (db.prepare("SELECT COUNT(*) as n FROM subjects").get() as { n: number }).n;
  if (subjectCount > 0) return;

  const today = localDateStr();
  const daysAgo = (n: number) => localDateStr(-n);
  const daysAhead = (n: number) => localDateStr(n);

  // Seed subjects
  const insSubject = db.prepare("INSERT INTO subjects (name, short, hue, credits) VALUES (?, ?, ?, ?)");
  insSubject.run("Capital Markets",                "Capital Markets",   200, 6);
  insSubject.run("Financial Engineering",          "Fin. Engineering",  280, 6);
  insSubject.run("Computational Finance",          "Comp. Finance",     160, 4);
  insSubject.run("Econometrics",                   "Econometrics",       30, 6);
  insSubject.run("Applied Programming in Finance", "Appl. Programming", 340, 4);

  const subjects = db.prepare("SELECT id, name FROM subjects ORDER BY id").all() as { id: number; name: string }[];
  const s = (name: string) => subjects.find(x => x.name === name)!.id;

  // Seed classes
  const insCls = db.prepare(
    "INSERT INTO classes (subject_id, week, title, date, summarized, tasks_total, tasks_done) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  // Capital Markets
  insCls.run(s("Capital Markets"), 1, "Mercados primarios y secundarios",   daysAgo(35), 1, 0, 0);
  insCls.run(s("Capital Markets"), 2, "Bonos cupón cero y duration",        daysAgo(28), 1, 2, 2);
  insCls.run(s("Capital Markets"), 3, "Curva de rendimientos",              daysAgo(21), 1, 3, 2);
  insCls.run(s("Capital Markets"), 4, "Estructura temporal de tasas",       daysAgo(14), 1, 2, 2);
  insCls.run(s("Capital Markets"), 5, "Modelo CAPM",                        daysAgo(7),  1, 4, 2);
  insCls.run(s("Capital Markets"), 6, "Frontera eficiente de Markowitz",    today,       0, 0, 0);

  // Financial Engineering
  insCls.run(s("Financial Engineering"), 1, "Derivados: forwards y futuros",   daysAgo(33), 1, 1, 1);
  insCls.run(s("Financial Engineering"), 2, "Pricing de opciones europeas",     daysAgo(26), 1, 3, 3);
  insCls.run(s("Financial Engineering"), 3, "Black-Scholes-Merton",             daysAgo(19), 1, 2, 1);
  insCls.run(s("Financial Engineering"), 4, "Las griegas: Δ Γ Θ ν",             daysAgo(12), 0, 0, 0);
  insCls.run(s("Financial Engineering"), 5, "Cobertura delta y gamma",          daysAgo(5),  0, 0, 0);

  // Computational Finance
  insCls.run(s("Computational Finance"), 1, "Monte Carlo: fundamentos",        daysAgo(32), 1, 2, 2);
  insCls.run(s("Computational Finance"), 2, "Reducción de varianza",            daysAgo(25), 1, 1, 1);
  insCls.run(s("Computational Finance"), 3, "Diferencias finitas explícitas",   daysAgo(18), 1, 2, 2);
  insCls.run(s("Computational Finance"), 4, "Esquemas implícitos · Crank-N.",   daysAgo(11), 1, 3, 2);
  insCls.run(s("Computational Finance"), 5, "Calibración por gradient descent", daysAgo(4),  1, 2, 1);

  // Econometrics — most unsummarized
  insCls.run(s("Econometrics"), 1, "OLS y supuestos clásicos",          daysAgo(34), 1, 2, 2);
  insCls.run(s("Econometrics"), 2, "Heterocedasticidad",                 daysAgo(27), 1, 3, 1);
  insCls.run(s("Econometrics"), 3, "Autocorrelación · Durbin-Watson",    daysAgo(20), 0, 0, 0);
  insCls.run(s("Econometrics"), 4, "Variables instrumentales",           daysAgo(13), 0, 0, 0);
  insCls.run(s("Econometrics"), 5, "Series de tiempo: ARIMA",            daysAgo(6),  0, 0, 0);

  // Applied Programming
  insCls.run(s("Applied Programming in Finance"), 1, "Numpy + pandas refresher",    daysAgo(31), 1, 1, 1);
  insCls.run(s("Applied Programming in Finance"), 2, "Backtesting con vectorbt",     daysAgo(24), 1, 2, 2);
  insCls.run(s("Applied Programming in Finance"), 3, "API trading con ccxt",         daysAgo(17), 1, 3, 2);
  insCls.run(s("Applied Programming in Finance"), 4, "Persistencia · SQLite + ORM",  daysAgo(10), 1, 2, 2);
  insCls.run(s("Applied Programming in Finance"), 5, "Despliegue · Docker básico",   daysAgo(3),  1, 4, 2);

  // Seed exams
  const insExam = db.prepare("INSERT INTO exams (subject_id, title, type, date, grade, weight) VALUES (?, ?, ?, ?, ?, ?)");
  insExam.run(s("Econometrics"),                   "Parcial 1",  "parcial", daysAhead(3),  null, 0.4);
  insExam.run(s("Financial Engineering"),          "TP entrega", "tp",      daysAhead(8),  null, 0.2);
  insExam.run(s("Capital Markets"),                "Parcial 1",  "parcial", daysAgo(20),   8.5,  0.4);
  insExam.run(s("Computational Finance"),          "TP1",        "tp",      daysAgo(15),   9.0,  0.3);
  insExam.run(s("Applied Programming in Finance"), "TP1",        "tp",      daysAgo(10),   9.5,  0.3);
  insExam.run(s("Financial Engineering"),          "Quiz 1",     "quiz",    daysAgo(22),   7.0,  0.1);
  insExam.run(s("Econometrics"),                   "Quiz",       "quiz",    daysAgo(8),    6.0,  0.1);

  // Seed tasks (facultad only)
  const insTask = db.prepare(
    "INSERT INTO tasks (title, priority, due_date, subject_id) VALUES (?, ?, ?, ?)"
  );
  insTask.run("Resolver práctica TP3: tests de heterocedasticidad", "alta", daysAhead(2), s("Econometrics"));
  insTask.run("Revisar parcial corregido de Capital Markets",        "media", daysAhead(1), s("Capital Markets"));
  insTask.run("Implementar pricer de opciones en Python",            "media", daysAhead(5), s("Financial Engineering"));
  insTask.run("Entregar TP de simulación Monte Carlo",               "alta",  daysAhead(4), s("Computational Finance"));
  insTask.run("Completar ejercicios de Docker",                      "baja",  daysAhead(7), s("Applied Programming in Finance"));
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

export function getDb(): Database.Database {
  if (!global.__db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    global.__db = new Database(DB_PATH);
    initSchema(global.__db);
    seedData(global.__db);
    seedGlossary(global.__db);
  }
  return global.__db;
}
