export type Context = "facultad" | "newfolio" | "casa";
export type Priority = "alta" | "media" | "baja";
export type TaskStatus = "pendiente" | "hecha";

export interface Task {
  id: number;
  title: string;
  context: Context;
  priority: Priority;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
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

export const CONTEXTS: { slug: Context; label: string }[] = [
  { slug: "facultad", label: "Facultad" },
  { slug: "newfolio", label: "NewFolio" },
  { slug: "casa", label: "Casa" },
];

export const PRIORITY_ORDER: Record<Priority, number> = {
  alta: 1,
  media: 2,
  baja: 3,
};
