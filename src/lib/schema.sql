-- Tasks: core unit of work
CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  context      TEXT    NOT NULL CHECK(context IN ('facultad', 'newfolio', 'casa')),
  priority     TEXT    NOT NULL DEFAULT 'media' CHECK(priority IN ('alta', 'media', 'baja')),
  due_date     TEXT,                          -- YYYY-MM-DD, nullable
  status       TEXT    NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'hecha')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT                           -- datetime when marked done, nullable
);

-- Habits: recurring daily behaviors to track
CREATE TABLE IF NOT EXISTS habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  active     INTEGER NOT NULL DEFAULT 1,      -- 1 = active, 0 = archived
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Habit logs: one row per (habit, date) when the habit was completed
CREATE TABLE IF NOT EXISTS habit_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      TEXT    NOT NULL,                 -- YYYY-MM-DD
  UNIQUE(habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_context    ON tasks(context);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date  ON habit_logs(date);
