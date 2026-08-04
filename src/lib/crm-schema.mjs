/**
 * Schema y seed del CRM en JS plano: lo importan `src/lib/db.ts` (migración
 * automática al abrir la DB, como el resto de las tablas) y
 * `scripts/migrate-clientes.mjs` (corrida manual). Una sola fuente para los dos
 * caminos, así no se desincronizan.
 *
 * Todo es idempotente: CREATE TABLE IF NOT EXISTS, índices IF NOT EXISTS y alta
 * de columnas sólo si faltan. Se puede correr las veces que haga falta.
 */

export const FUENTES = ["UdeSA", "Referido", "NewsFolio", "Contenido", "Frío", "Otro"];

export const ETAPAS = [
  "Prospecto",
  "Primer contacto",
  "Reunión agendada",
  "Propuesta enviada",
  "Cliente activo",
  "Descartado",
];

export const PERFILES_RIESGO = ["Conservador", "Moderado", "Agresivo"];

const enumCheck = (columna, valores) =>
  `CHECK(${columna} IN (${valores.map((v) => `'${v}'`).join(",")}))`;

export const CLIENTES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS clientes (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre               TEXT    NOT NULL,
    apellido             TEXT    NOT NULL DEFAULT '',
    email                TEXT,
    telefono             TEXT,
    fuente               TEXT    NOT NULL DEFAULT 'Otro' ${enumCheck("fuente", FUENTES)},
    referido_por         TEXT,
    etapa                TEXT    NOT NULL DEFAULT 'Prospecto' ${enumCheck("etapa", ETAPAS)},
    ticket_estimado      REAL    NOT NULL DEFAULT 0,
    perfil_riesgo        TEXT    ${enumCheck("perfil_riesgo", PERFILES_RIESGO)},
    productos_interes    TEXT,
    proxima_accion       TEXT,
    fecha_proxima_accion TEXT,
    ultima_interaccion   TEXT,
    notas                TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_clientes_etapa   ON clientes(etapa);
  CREATE INDEX IF NOT EXISTS idx_clientes_proxima ON clientes(fecha_proxima_accion);
  CREATE INDEX IF NOT EXISTS idx_clientes_fuente  ON clientes(fuente);
`;

/** Columnas que se agregan a una tabla clientes anterior a este schema. */
const COLUMNAS_TARDIAS = [
  ["referido_por", "TEXT"],
  ["perfil_riesgo", "TEXT"],
  ["productos_interes", "TEXT"],
  ["proxima_accion", "TEXT"],
  ["fecha_proxima_accion", "TEXT"],
  ["ultima_interaccion", "TEXT"],
  ["notas", "TEXT"],
  ["updated_at", "TEXT"],
];

/**
 * Crea la tabla si falta y suma las columnas que falten en una instalación
 * vieja. No borra ni reescribe nada existente.
 * @param {import('better-sqlite3').Database} db
 * @returns {{ creada: boolean, columnasAgregadas: string[] }}
 */
export function migrarClientes(db) {
  const existiaAntes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clientes'")
    .get() !== undefined;

  db.exec(CLIENTES_SCHEMA_SQL);

  const columnas = new Set(
    db.prepare("PRAGMA table_info(clientes)").all().map((c) => c.name)
  );
  const columnasAgregadas = [];
  for (const [nombre, tipo] of COLUMNAS_TARDIAS) {
    if (columnas.has(nombre)) continue;
    db.exec(`ALTER TABLE clientes ADD COLUMN ${nombre} ${tipo}`);
    columnasAgregadas.push(nombre);
  }

  return { creada: !existiaAntes, columnasAgregadas };
}

// ── Seed ──────────────────────────────────────────────────────────────────────

function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hoyISO(d);
}

/**
 * 9 registros ficticios para poder probar la pantalla: hay acciones vencidas,
 * de hoy y de esta semana, y las seis etapas están representadas.
 * @returns {Array<Object>}
 */
export function clientesDeEjemplo() {
  return [
    {
      nombre: "Martina", apellido: "Álvarez", email: "martina.alvarez@example.com", telefono: "+54 9 11 5555-1042",
      fuente: "UdeSA", referido_por: null, etapa: "Cliente activo", ticket_estimado: 145000,
      perfil_riesgo: "Moderado", productos_interes: "Bonos soberanos, FCI money market",
      proxima_accion: "Rebalanceo trimestral de cartera", fecha_proxima_accion: enDias(-2),
      ultima_interaccion: enDias(-16), notas: "Compañera de la facultad. Ya transfirió la cartera desde otro ALyC. Quiere revisar la exposición a soberanos largos.",
    },
    {
      nombre: "Joaquín", apellido: "Ferreyra", email: "j.ferreyra@example.com", telefono: "+54 9 11 4422-8890",
      fuente: "Referido", referido_por: "Martina Álvarez", etapa: "Propuesta enviada", ticket_estimado: 90000,
      perfil_riesgo: "Conservador", productos_interes: "Lecaps, FCI T+1",
      proxima_accion: "Llamar para cerrar la propuesta", fecha_proxima_accion: hoyISO(),
      ultima_interaccion: enDias(-4), notas: "Le mandé la propuesta con 70% pesos corto y 30% hard-dollar. Le preocupa la volatilidad.",
    },
    {
      nombre: "Sofía", apellido: "Bianchi", email: "sofia.bianchi@example.com", telefono: null,
      fuente: "NewsFolio", referido_por: null, etapa: "Reunión agendada", ticket_estimado: 60000,
      perfil_riesgo: "Agresivo", productos_interes: "CEDEARs, acciones argentinas",
      proxima_accion: "Reunión por Meet, 10:30", fecha_proxima_accion: hoyISO(),
      ultima_interaccion: enDias(-1), notas: "Llegó por la newsletter. Opera sola hace dos años y quiere delegar la parte de renta fija.",
    },
    {
      nombre: "Tomás", apellido: "Grimaldi", email: "tomas.grimaldi@example.com", telefono: "+54 9 351 233-9876",
      fuente: "Contenido", referido_por: null, etapa: "Primer contacto", ticket_estimado: 25000,
      perfil_riesgo: "Moderado", productos_interes: "FCI, plazo fijo UVA",
      proxima_accion: "Mandar material sobre FCI vs plazo fijo", fecha_proxima_accion: enDias(2),
      ultima_interaccion: enDias(-3), notas: "Escribió por un posteo de LinkedIn. Primer ahorro formal, arranca de cero.",
    },
    {
      nombre: "Valentina", apellido: "Rossi", email: "valen.rossi@example.com", telefono: "+54 9 11 6677-3311",
      fuente: "Referido", referido_por: "Estudio contable Pérez", etapa: "Cliente activo", ticket_estimado: 320000,
      perfil_riesgo: "Conservador", productos_interes: "Obligaciones negociables, bonos ley NY",
      proxima_accion: "Informe mensual de cartera", fecha_proxima_accion: enDias(5),
      ultima_interaccion: enDias(-8), notas: "Cliente más grande de la cartera. Vende un campo en marzo y va a sumar fondos.",
    },
    {
      nombre: "Ignacio", apellido: "Sosa", email: null, telefono: "+54 9 11 3344-2201",
      fuente: "Frío", referido_por: null, etapa: "Prospecto", ticket_estimado: 15000,
      perfil_riesgo: null, productos_interes: "No definido",
      proxima_accion: "Primer llamado de contacto", fecha_proxima_accion: enDias(-5),
      ultima_interaccion: null, notas: "Contacto de una lista fría. Todavía no atendió.",
    },
    {
      nombre: "Camila", apellido: "Duarte", email: "camila.duarte@example.com", telefono: "+54 9 341 588-1200",
      fuente: "UdeSA", referido_por: null, etapa: "Propuesta enviada", ticket_estimado: 75000,
      perfil_riesgo: "Moderado", productos_interes: "Cartera mixta ARS/USD",
      proxima_accion: "Seguimiento de la propuesta", fecha_proxima_accion: enDias(4),
      ultima_interaccion: enDias(-6), notas: "Trabaja en una fintech en Rosario. Quiere dolarizar la mitad del ahorro.",
    },
    {
      nombre: "Federico", apellido: "Lombardi", email: "f.lombardi@example.com", telefono: "+54 9 11 2299-4455",
      fuente: "Referido", referido_por: "Valentina Rossi", etapa: "Reunión agendada", ticket_estimado: 180000,
      perfil_riesgo: "Agresivo", productos_interes: "Bonos hard-dollar, CEDEARs tecnológicos",
      proxima_accion: "Reunión presencial en la oficina", fecha_proxima_accion: enDias(1),
      ultima_interaccion: enDias(-2), notas: "Referido de Valentina. Viene de una experiencia mala con otro asesor: cobrarle claridad en las comisiones.",
    },
    {
      nombre: "Lucía", apellido: "Peralta", email: "lucia.peralta@example.com", telefono: null,
      fuente: "Contenido", referido_por: null, etapa: "Descartado", ticket_estimado: 8000,
      perfil_riesgo: "Conservador", productos_interes: "Plazo fijo",
      proxima_accion: null, fecha_proxima_accion: null,
      ultima_interaccion: enDias(-45), notas: "Buscaba sólo plazo fijo bancario. No hay fit con el servicio. Retomar en un año.",
    },
  ];
}

/**
 * Inserta los registros de ejemplo sólo si la tabla está vacía.
 * @param {import('better-sqlite3').Database} db
 * @returns {number} cantidad insertada
 */
export function seedClientes(db) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM clientes").get();
  if (n > 0) return 0;

  const ins = db.prepare(
    `INSERT INTO clientes (
       nombre, apellido, email, telefono, fuente, referido_por, etapa, ticket_estimado,
       perfil_riesgo, productos_interes, proxima_accion, fecha_proxima_accion,
       ultima_interaccion, notas
     ) VALUES (
       @nombre, @apellido, @email, @telefono, @fuente, @referido_por, @etapa, @ticket_estimado,
       @perfil_riesgo, @productos_interes, @proxima_accion, @fecha_proxima_accion,
       @ultima_interaccion, @notas
     )`
  );

  const filas = clientesDeEjemplo();
  db.transaction((items) => { for (const c of items) ins.run(c); })(filas);
  return filas.length;
}
