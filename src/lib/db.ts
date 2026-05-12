import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { localDateStr } from "@/lib/utils";

const DB_DIR  = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "dashboard.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function initSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      context      TEXT    NOT NULL DEFAULT 'facultad',
      priority     TEXT    NOT NULL DEFAULT 'media' CHECK(priority IN ('alta', 'media', 'baja')),
      due_date     TEXT,
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

    CREATE TABLE IF NOT EXISTS subjects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS class_materials (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id       INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      type             TEXT NOT NULL CHECK(type IN ('pdf', 'text')),
      filename         TEXT,
      original_content TEXT,
      date             TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL REFERENCES class_materials(id) ON DELETE CASCADE,
      subject_id  INTEGER NOT NULL REFERENCES subjects(id),
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exams (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title      TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'parcial' CHECK(type IN ('parcial','final','tp','quiz','otro')),
      date       TEXT    NOT NULL,
      grade      REAL,
      notes      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL CHECK(amount > 0),
      type        TEXT    NOT NULL CHECK(type IN ('ingreso', 'gasto')),
      category    TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      date        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due_date     ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit   ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date    ON habit_logs(date);
    CREATE INDEX IF NOT EXISTS idx_materials_subject  ON class_materials(subject_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_material ON summaries(material_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_subject  ON summaries(subject_id);
    CREATE INDEX IF NOT EXISTS idx_exams_subject      ON exams(subject_id);
    CREATE INDEX IF NOT EXISTS idx_exams_date         ON exams(date);
  `);

  // Runtime migrations — idempotent via try/catch
  try { db.exec("ALTER TABLE tasks ADD COLUMN subject_id INTEGER REFERENCES subjects(id)"); } catch { /* exists */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_id)"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE exams ADD COLUMN weight REAL NOT NULL DEFAULT 1"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE subjects ADD COLUMN credits INTEGER NOT NULL DEFAULT 4"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE tasks ADD COLUMN material_id INTEGER REFERENCES class_materials(id) ON DELETE SET NULL"); } catch { /* exists */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_material ON tasks(material_id)"); } catch { /* exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      date       TEXT    NOT NULL,
      minutes    INTEGER NOT NULL CHECK(minutes > 0),
      notes      TEXT    DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_study_sessions_subject ON study_sessions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_study_sessions_date    ON study_sessions(date);
  `);

  // Remove legacy non-faculty tasks — this app is faculty-only
  db.exec(`DELETE FROM tasks WHERE context != 'facultad'`);
  // Remove arancel task — not the student's responsibility
  db.exec(`DELETE FROM tasks WHERE title LIKE '%arancel%'`);
}

function seedData(db: Database.Database) {
  const taskCount = (db.prepare("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n;
  if (taskCount === 0) {
    const today    = localDateStr();
    const tomorrow = localDateStr(1);
    const yesterday = localDateStr(-1);

    const ins = db.prepare(
      "INSERT INTO tasks (title, context, priority, due_date, status, completed_at) VALUES (?, 'facultad', ?, ?, ?, ?)"
    );
    ins.run("Leer paper de Black-Scholes",          "alta",  tomorrow,  "pendiente", null);
    ins.run("Hacer ejercicios de Econometría",       "alta",  today,     "pendiente", null);
    ins.run("Revisar apuntes de Capital Markets",    "media", today,     "pendiente", null);
    ins.run("Entregar TP de Financial Engineering",  "alta",  yesterday, "pendiente", null);
    ins.run("Preparar preguntas para el parcial",    "media", tomorrow,  "pendiente", null);
    ins.run("Leer módulo 3 de Comp. Finance",        "baja",  localDateStr(3), "hecha", `${today}T09:00:00`);
  }

  const habitCount = (db.prepare("SELECT COUNT(*) as n FROM habits").get() as { n: number }).n;
  if (habitCount === 0) {
    const inH = db.prepare("INSERT INTO habits (name) VALUES (?)");
    const inL = db.prepare("INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)");
    const h1  = inH.run("Estudiar 2hs");
    const h2  = inH.run("Repasar apuntes");
    const h3  = inH.run("Ejercicios");

    [localDateStr(0), localDateStr(-1), localDateStr(-2)].forEach(d => inL.run(h1.lastInsertRowid, d));
    Array.from({ length: 6 }, (_, i) => localDateStr(-i)).forEach(d => inL.run(h2.lastInsertRowid, d));
    [localDateStr(-1), localDateStr(-2)].forEach(d => inL.run(h3.lastInsertRowid, d));
  }
}

const SUBJECT_NAMES = [
  "Capital Markets",
  "International Finance",
  "Financial Engineering",
  "Applied Programming in Finance",
  "Econometrics",
  "Computational Finance",
];

function seedSubjects(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM subjects").get() as { n: number }).n;
  if (count > 0) return;
  const ins = db.prepare("INSERT OR IGNORE INTO subjects (name) VALUES (?)");
  for (const name of SUBJECT_NAMES) ins.run(name);
}

export function getDb(): Database.Database {
  if (!global.__db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    global.__db = new Database(DB_PATH);
    initSchema(global.__db);
    seedSubjects(global.__db);
    seedData(global.__db);
  }
  return global.__db;
}
