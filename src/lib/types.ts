export type Priority    = "alta" | "media" | "baja";
export type TaskStatus  = "pendiente" | "hecha";
export type ExamType    = "parcial" | "final" | "tp" | "quiz" | "otro";

export interface Task {
  id: number;
  title: string;
  context: "facultad";
  priority: Priority;
  due_date: string | null;
  subject_id: number | null;
  material_id: number | null;   // set when task was extracted from a class material
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

export const PRIORITY_ORDER: Record<Priority, number> = {
  alta: 1,
  media: 2,
  baja: 3,
};

// ── Facultad ──────────────────────────────────────────────────────────────────

export interface Subject {
  id: number;
  name: string;
  credits: number;      // academic credits / horas cátedra (for weighted GPA)
  created_at: string;
}

export interface ClassMaterial {
  id: number;
  subject_id: number;
  type: "pdf" | "text";
  filename: string | null;
  original_content: string | null;
  date: string;
  created_at: string;
}

export interface Summary {
  id: number;
  material_id: number;
  subject_id: number;
  content: string;
  created_at: string;
}

export interface Exam {
  id: number;
  subject_id: number;
  title: string;
  type: ExamType;
  date: string;          // YYYY-MM-DD
  grade: number | null;  // 0–10 Argentine scale
  weight: number;        // relative weight in subject grade (default 1)
  notes: string | null;
  created_at: string;
}

export interface StudySession {
  id: number;
  subject_id: number;
  date: string;          // YYYY-MM-DD
  minutes: number;
  notes: string;
  created_at: string;
}

// ── Chart / Stats data shapes ─────────────────────────────────────────────────

export interface HeatmapDay {
  date: string;
  count: number;
}

/** Keys are subject names + "week". Values are counts (number) or the week label (string). */
export interface WeeklySubjectBar {
  week: string;
  [subject: string]: number | string;
}

export interface HabitConsistencyPoint {
  date: string;
  done: number;
  total: number;
  pct: number;
}

export interface StatsSummary {
  totalDone: number;
  doneThisWeek: number;
  doneLast30: number;
  currentStreakDays: number;
}

export interface ExamGradePoint {
  subject: string;
  date: string;
  grade: number;
  type: ExamType;
  title: string;
}

// ── Predictive analytics ──────────────────────────────────────────────────────

/** One row in the burn-down table — one entry per subject */
export interface BurndownRow {
  subjectId: number;
  subjectName: string;
  pendingTasks: number;
  nextExamDate: string | null;
  nextExamTitle: string | null;
  daysUntilExam: number | null;
  tasksPerDay: number | null;  // tasks/day needed to clear backlog before exam
}

/** Study Return-on-Investment per subject */
export interface SubjectROI {
  subjectId: number;
  subjectName: string;
  totalMinutes: number;
  avgGrade: number | null;   // average of graded exams
  roi: number | null;        // avgGrade / hours studied
}

/** Delivery deviation stats across all completed tasks */
export interface DeliveryDeviation {
  avgDaysLate: number;    // positive = late, 0 = perfect, negative = early
  onTimeRate: number;     // 0–1
  sampleSize: number;
}

/** Weighted GPA per subject (uses exam weights + subject credits) */
export interface SubjectGPA {
  subjectId: number;
  subjectName: string;
  credits: number;
  weightedAvg: number | null;  // null if no graded exams
  gradedExams: number;
  totalExams: number;
}

/** Input fed to the GradeSimulator client component */
export interface GradeSimSubject {
  id: number;
  name: string;
  exams: Array<{
    id: number;
    title: string;
    type: ExamType;
    date: string;
    weight: number;
    grade: number | null;
  }>;
}
