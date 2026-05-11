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

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      context      TEXT    NOT NULL CHECK(context IN ('facultad', 'newfolio', 'casa')),
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

    CREATE INDEX IF NOT EXISTS idx_tasks_context    ON tasks(context);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date  ON habit_logs(date);
  `);
}

function seedData(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n;
  if (count > 0) return;

  const today = localDateStr();
  const yesterday = localDateStr(-1);
  const twoDaysAgo = localDateStr(-2);
  const tomorrow = localDateStr(1);

  const insertTask = db.prepare(
    "INSERT INTO tasks (title, context, priority, due_date, status, completed_at) VALUES (?, ?, ?, ?, ?, ?)"
  );

  // Facultad
  insertTask.run("Entregar TP de Algoritmos", "facultad", "alta", today, "pendiente", null);
  insertTask.run("Leer capítulo 5 — Redes", "facultad", "media", today, "pendiente", null);
  insertTask.run("Resolver ejercicios de Álgebra", "facultad", "baja", tomorrow, "pendiente", null);
  insertTask.run("Pagar arancel", "facultad", "alta", yesterday, "pendiente", null);
  insertTask.run("Revisar parcial corregido", "facultad", "media", twoDaysAgo, "pendiente", null);

  // NewFolio
  insertTask.run("Revisar PR de backend", "newfolio", "alta", today, "pendiente", null);
  insertTask.run("Escribir tests para auth", "newfolio", "media", today, "pendiente", null);
  insertTask.run("Diseñar landing page", "newfolio", "alta", tomorrow, "pendiente", null);
  insertTask.run("Actualizar README", "newfolio", "baja", today, "hecha", `${today}T10:00:00`);

  // Casa
  insertTask.run("Comprar mercadería", "casa", "media", today, "pendiente", null);
  insertTask.run("Pagar factura de luz", "casa", "alta", yesterday, "pendiente", null);
  insertTask.run("Llamar al médico", "casa", "media", today, "pendiente", null);

  // Habits
  const insertHabit = db.prepare("INSERT INTO habits (name) VALUES (?)");
  const h1 = insertHabit.run("Gimnasio");
  const h2 = insertHabit.run("Creatina");
  const h3 = insertHabit.run("Estudiar");

  const insertLog = db.prepare(
    "INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)"
  );

  // Gimnasio: last 3 days
  [localDateStr(0), localDateStr(-1), localDateStr(-2)].forEach((d) =>
    insertLog.run(h1.lastInsertRowid, d)
  );
  // Creatina: last 7 days
  Array.from({ length: 7 }, (_, i) => localDateStr(-i)).forEach((d) =>
    insertLog.run(h2.lastInsertRowid, d)
  );
  // Estudiar: 3 days ago through yesterday (streak broken today)
  [localDateStr(-1), localDateStr(-2), localDateStr(-3)].forEach((d) =>
    insertLog.run(h3.lastInsertRowid, d)
  );
}

export function getDb(): Database.Database {
  if (!global.__db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    global.__db = new Database(DB_PATH);
    initSchema(global.__db);
    seedData(global.__db);
  }
  return global.__db;
}
