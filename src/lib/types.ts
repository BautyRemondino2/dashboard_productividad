export type Priority = "alta" | "media" | "baja";
export type TaskStatus = "pendiente" | "hecha";
export type ExamType = "parcial" | "tp" | "final" | "quiz";

export interface Subject {
  id: number;
  name: string;
  short: string;
  hue: number;
  credits: number;
  semester_id: number | null;
}

export interface Semester {
  id: number;
  name: string;
  status: "active" | "archived";
  created_at: string;
  archived_at: string | null;
}

export interface ClassItem {
  id: number;
  subject_id: number;
  week: number;
  title: string;
  date: string;
  summarized: number;  // 0 | 1 (SQLite boolean)
  summary: string | null;
  tasks_total: number;
  tasks_done: number;
  is_new: number;      // 0 | 1
}

export interface Exam {
  id: number;
  subject_id: number;
  title: string;
  type: ExamType;
  date: string;
  grade: number | null;
  weight: number;
}

export interface Task {
  id: number;
  title: string;
  context: string;
  priority: Priority;
  due_date: string | null;
  subject_id: number | null;
  material_id: number | null;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
  // optional join field
  subject_name?: string;
}

export interface Habit {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  date: string;
}

export type MaterialKind = "slide" | "ejercicio" | "excel" | "lectura" | "notas" | "imagen" | "otro";

export interface ClassMaterial {
  id: number;
  subject_id: number;
  class_id: number | null;
  kind: MaterialKind;
  filename: string;
  file_path: string;
  mime: string | null;
  size_bytes: number;
  summary: string | null;
  created_at: string;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  alta: 1,
  media: 2,
  baja: 3,
};
