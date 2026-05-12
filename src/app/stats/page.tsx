import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import type {
  HeatmapDay,
  WeeklySubjectBar,
  HabitConsistencyPoint,
  StatsSummary,
  ExamGradePoint,
  Subject,
  BurndownRow,
  SubjectROI,
  DeliveryDeviation,
  SubjectGPA,
  GradeSimSubject,
  ExamType,
} from "@/lib/types";
import ActivityHeatmap       from "@/components/stats/ActivityHeatmap";
import TasksBySubjectChart   from "@/components/stats/TasksBySubjectChart";
import HabitConsistencyChart from "@/components/stats/HabitConsistencyChart";
import ExamGradeChart        from "@/components/stats/ExamGradeChart";
import GradeSimulator        from "@/components/stats/GradeSimulator";
import StudySessionLog       from "@/components/stats/StudySessionLog";
import StudyROIChart         from "@/components/stats/StudyROIChart";

// ── Row types for DB queries ───────────────────────────────────────────────────

interface DayRow    { day: string; count: number }
interface WeekRow   { week: string; subject: string | null; count: number }
interface HabitRow  { date: string; done: number }
interface StatsRow  { total_done: number; done_this_week: number; done_last30: number }
interface StreakRow  { day: string }
interface ActiveRow { n: number }
interface GradeRow  { subject_name: string; date: string; grade: number; type: string; title: string }

interface BurndownRaw {
  subject_id: number; subject_name: string;
  pending_tasks: number;
  next_exam_date: string | null; next_exam_title: string | null;
  days_until_exam: number | null;
}

interface GpaRaw {
  subject_id: number; subject_name: string; credits: number;
  weighted_avg: number | null; graded_exams: number; total_exams: number;
}

interface RoiRaw {
  subject_id: number; subject_name: string;
  total_minutes: number; avg_grade: number | null;
}

interface DeviationRaw { delta: number }

interface ExamForSim {
  id: number; subject_id: number; title: string;
  type: string; date: string; weight: number; grade: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  const [, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const db      = getDb();
  const today   = localDateStr();
  const subjects = db.prepare("SELECT * FROM subjects ORDER BY name").all() as Subject[];

  /* ────────────────────────────────────────────────────────────────────────────
   * 1. BURN-DOWN — tasks needed per day per subject before next exam
   * ─────────────────────────────────────────────────────────────────────────── */
  const burndownRaw = db.prepare(`
    SELECT
      s.id   as subject_id,
      s.name as subject_name,
      COUNT(DISTINCT t.id) as pending_tasks,
      MIN(e.date)          as next_exam_date,
      MIN(e.title)         as next_exam_title,
      ROUND(julianday(MIN(e.date)) - julianday('now', 'localtime')) as days_until_exam
    FROM subjects s
    LEFT JOIN tasks t ON t.subject_id = s.id AND t.status = 'pendiente'
    LEFT JOIN exams e ON e.subject_id = s.id AND e.date >= date('now', 'localtime')
    GROUP BY s.id
    ORDER BY days_until_exam ASC, pending_tasks DESC
  `).all() as BurndownRaw[];

  const burndown: BurndownRow[] = burndownRaw.map(r => {
    const tpd = r.days_until_exam !== null && r.days_until_exam > 0 && r.pending_tasks > 0
      ? parseFloat((r.pending_tasks / r.days_until_exam).toFixed(2))
      : null;
    return {
      subjectId:     r.subject_id,
      subjectName:   r.subject_name,
      pendingTasks:  r.pending_tasks,
      nextExamDate:  r.next_exam_date,
      nextExamTitle: r.next_exam_title,
      daysUntilExam: r.days_until_exam,
      tasksPerDay:   tpd,
    };
  });

  /* ────────────────────────────────────────────────────────────────────────────
   * 2. WEIGHTED GPA — subject credits × weighted exam average
   * ─────────────────────────────────────────────────────────────────────────── */
  const gpaRaw = db.prepare(`
    SELECT
      s.id      as subject_id,
      s.name    as subject_name,
      s.credits as credits,
      CASE WHEN SUM(CASE WHEN e.grade IS NOT NULL THEN e.weight ELSE 0 END) > 0
           THEN SUM(CASE WHEN e.grade IS NOT NULL THEN e.grade * e.weight ELSE 0 END)
              / SUM(CASE WHEN e.grade IS NOT NULL THEN e.weight ELSE 0 END)
           ELSE NULL END as weighted_avg,
      COUNT(CASE WHEN e.grade IS NOT NULL THEN 1 END) as graded_exams,
      COUNT(e.id) as total_exams
    FROM subjects s
    LEFT JOIN exams e ON e.subject_id = s.id
    GROUP BY s.id
    ORDER BY s.name
  `).all() as GpaRaw[];

  const subjectGPAs: SubjectGPA[] = gpaRaw.map(r => ({
    subjectId:   r.subject_id,
    subjectName: r.subject_name,
    credits:     r.credits,
    weightedAvg: r.weighted_avg,
    gradedExams: r.graded_exams,
    totalExams:  r.total_exams,
  }));

  const gradedSubjects = subjectGPAs.filter(s => s.weightedAvg !== null);
  const weightedGPA = gradedSubjects.length > 0
    ? gradedSubjects.reduce((s, g) => s + g.weightedAvg! * g.credits, 0)
      / gradedSubjects.reduce((s, g) => s + g.credits, 0)
    : null;

  /* ────────────────────────────────────────────────────────────────────────────
   * 3. DELIVERY DEVIATION — procrastination factor
   * ─────────────────────────────────────────────────────────────────────────── */
  const deviationRaw = db.prepare(`
    SELECT ROUND(julianday(date(completed_at, 'localtime')) - julianday(due_date)) as delta
    FROM tasks
    WHERE status = 'hecha'
      AND completed_at IS NOT NULL
      AND due_date     IS NOT NULL
      AND context = 'facultad'
  `).all() as DeviationRaw[];

  let deviation: DeliveryDeviation | null = null;
  if (deviationRaw.length > 0) {
    const deltas  = deviationRaw.map(r => r.delta);
    const avg     = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const onTime  = deltas.filter(d => d <= 0).length;
    deviation = {
      avgDaysLate: parseFloat(avg.toFixed(1)),
      onTimeRate:  parseFloat((onTime / deltas.length).toFixed(2)),
      sampleSize:  deltas.length,
    };
  }

  /* ────────────────────────────────────────────────────────────────────────────
   * 4. STUDY ROI (IEE) — grade per hour studied per subject
   * ─────────────────────────────────────────────────────────────────────────── */
  const roiRaw = db.prepare(`
    SELECT
      s.id   as subject_id,
      s.name as subject_name,
      COALESCE(SUM(ss.minutes), 0) as total_minutes,
      AVG(e.grade) as avg_grade
    FROM subjects s
    LEFT JOIN study_sessions ss ON ss.subject_id = s.id
    LEFT JOIN exams e ON e.subject_id = s.id AND e.grade IS NOT NULL
    GROUP BY s.id
  `).all() as RoiRaw[];

  const studyROI: SubjectROI[] = roiRaw
    .filter(r => r.total_minutes > 0)
    .map(r => ({
      subjectId:    r.subject_id,
      subjectName:  r.subject_name,
      totalMinutes: r.total_minutes,
      avgGrade:     r.avg_grade,
      roi: r.avg_grade !== null && r.total_minutes > 0
        ? parseFloat((r.avg_grade / (r.total_minutes / 60)).toFixed(3))
        : null,
    }));

  /* ────────────────────────────────────────────────────────────────────────────
   * 5. GRADE SIMULATOR data
   * ─────────────────────────────────────────────────────────────────────────── */
  const allExams = db.prepare(`
    SELECT id, subject_id, title, type, date, weight, grade
    FROM exams ORDER BY subject_id, date
  `).all() as ExamForSim[];

  const gradeSimData: GradeSimSubject[] = subjects.map(s => ({
    id:   s.id,
    name: s.name,
    exams: allExams
      .filter(e => e.subject_id === s.id)
      .map(e => ({
        id:     e.id,
        title:  e.title,
        type:   e.type as ExamType,
        date:   e.date,
        weight: e.weight,
        grade:  e.grade,
      })),
  })).filter(s => s.exams.length > 0);

  /* ────────────────────────────────────────────────────────────────────────────
   * Existing stats
   * ─────────────────────────────────────────────────────────────────────────── */
  const heatmapRows = db.prepare(`
    SELECT date(completed_at, 'localtime') as day, COUNT(*) as count
    FROM tasks
    WHERE completed_at IS NOT NULL
      AND date(completed_at, 'localtime') >= date('now', 'localtime', '-364 days')
    GROUP BY day
  `).all() as DayRow[];
  const heatmapData: HeatmapDay[] = heatmapRows.map(r => ({ date: r.day, count: r.count }));

  const weekRows = db.prepare(`
    SELECT strftime('%Y-W%W', date(t.completed_at, 'localtime')) as week,
           s.name as subject,
           COUNT(*) as count
    FROM tasks t
    LEFT JOIN subjects s ON s.id = t.subject_id
    WHERE t.completed_at IS NOT NULL
      AND date(t.completed_at, 'localtime') >= date('now', 'localtime', '-55 days')
    GROUP BY week, subject
    ORDER BY week
  `).all() as WeekRow[];

  const subjectNames = subjects.map(s => s.name);
  const weekMap = new Map<string, WeeklySubjectBar>();
  for (const r of weekRows) {
    if (!weekMap.has(r.week)) {
      const entry: WeeklySubjectBar = { week: r.week };
      for (const s of subjectNames) entry[s] = 0;
      weekMap.set(r.week, entry);
    }
    const bar = weekMap.get(r.week)!;
    if (r.subject) bar[r.subject] = (bar[r.subject] as number ?? 0) + r.count;
  }
  const weeklyData: WeeklySubjectBar[] = Array.from(weekMap.values());

  const activeHabits = (db.prepare("SELECT COUNT(*) as n FROM habits WHERE active = 1").get() as ActiveRow).n;
  const habitRows    = db.prepare(`
    SELECT hl.date, COUNT(*) as done
    FROM habit_logs hl
    WHERE hl.date >= date('now', 'localtime', '-29 days')
    GROUP BY hl.date ORDER BY hl.date
  `).all() as HabitRow[];
  const habitData: HabitConsistencyPoint[] = habitRows.map(r => ({
    date: r.date, done: r.done, total: activeHabits,
    pct: activeHabits > 0 ? Math.round((r.done / activeHabits) * 100) : 0,
  }));

  const statsRow = db.prepare(`
    SELECT
      COUNT(*) as total_done,
      SUM(CASE WHEN date(completed_at,'localtime') >= date('now','weekday 1','-6 days','localtime') THEN 1 ELSE 0 END) as done_this_week,
      SUM(CASE WHEN date(completed_at,'localtime') >= date('now','localtime','-29 days') THEN 1 ELSE 0 END) as done_last30
    FROM tasks WHERE completed_at IS NOT NULL
  `).get() as StatsRow;

  const streakDays = db.prepare(`
    SELECT DISTINCT date(completed_at, 'localtime') as day
    FROM tasks WHERE completed_at IS NOT NULL ORDER BY day DESC
  `).all() as StreakRow[];
  let currentStreak = 0;
  const todayStr    = new Date().toLocaleDateString("en-CA");
  let expected      = new Date(todayStr);
  for (const { day } of streakDays) {
    const d    = new Date(day + "T00:00:00");
    const diff = Math.round((expected.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) { currentStreak++; expected.setDate(expected.getDate() - 1); }
    else if (diff === 1 && currentStreak === 0) { currentStreak++; expected = new Date(d); expected.setDate(expected.getDate() - 1); }
    else break;
  }
  const stats: StatsSummary = {
    totalDone: statsRow.total_done ?? 0, doneThisWeek: statsRow.done_this_week ?? 0,
    doneLast30: statsRow.done_last30 ?? 0, currentStreakDays: currentStreak,
  };

  const gradeRows = db.prepare(`
    SELECT s.name as subject_name, e.date, e.grade, e.type, e.title
    FROM exams e JOIN subjects s ON s.id = e.subject_id
    WHERE e.grade IS NOT NULL ORDER BY e.date ASC
  `).all() as GradeRow[];
  const examGrades: ExamGradePoint[] = gradeRows.map(r => ({
    subject: r.subject_name, date: r.date, grade: r.grade,
    type: r.type as ExamGradePoint["type"], title: r.title,
  }));

  const coverageData = subjects.map(s => {
    const mats = (db.prepare("SELECT COUNT(*) as n FROM class_materials WHERE subject_id = ?").get(s.id) as { n: number }).n;
    const sums = (db.prepare("SELECT COUNT(*) as n FROM summaries WHERE subject_id = ?").get(s.id) as { n: number }).n;
    return { name: s.name, total: mats, summarized: sums };
  }).filter(d => d.total > 0);

  // Total study hours
  const totalStudyMin = (db.prepare("SELECT COALESCE(SUM(minutes),0) as n FROM study_sessions").get() as { n: number }).n;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">Estadísticas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Análisis de tu rendimiento académico</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <StatCard label="GPA ponderado" value={weightedGPA !== null ? weightedGPA.toFixed(2) : "—"} accent={weightedGPA !== null && weightedGPA >= 7 ? "emerald" : weightedGPA !== null ? "amber" : undefined} />
        <StatCard label="Esta semana"   value={stats.doneThisWeek} accent="emerald" />
        <StatCard label="Horas de estudio" value={`${(totalStudyMin / 60).toFixed(0)}h`} accent={totalStudyMin > 0 ? "amber" : undefined} />
        <StatCard label="Racha"         value={`${stats.currentStreakDays}d`} accent={stats.currentStreakDays >= 3 ? "amber" : undefined} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 1: BURN-DOWN
      ══════════════════════════════════════════════════════════════════════ */}
      <Section title="Burn-down por materia" subtitle="Ritmo diario necesario para llegar al examen con backlog cero">
        {burndown.every(b => b.pendingTasks === 0 && b.nextExamDate === null) ? (
          <p className="text-sm text-slate-600 py-2">Sin tareas pendientes ni exámenes cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-600 border-b border-slate-800">
                  <th className="text-left py-2 pr-4 font-normal">Materia</th>
                  <th className="text-right py-2 px-4 font-normal">Tareas</th>
                  <th className="text-left py-2 px-4 font-normal">Próximo examen</th>
                  <th className="text-right py-2 px-4 font-normal">Días</th>
                  <th className="text-right py-2 pl-4 font-normal">Ritmo</th>
                </tr>
              </thead>
              <tbody>
                {burndown.map(row => {
                  const isUrgent   = row.daysUntilExam !== null && row.daysUntilExam <= 5 && row.pendingTasks > 0;
                  const isOverload = row.tasksPerDay !== null && row.tasksPerDay > 2;
                  return (
                    <tr key={row.subjectId} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <span className="text-slate-300">{row.subjectName}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        <span className={row.pendingTasks > 0 ? "text-amber-400" : "text-slate-600"}>
                          {row.pendingTasks}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {row.nextExamTitle ? (
                          <span className={`text-xs ${isUrgent ? "text-red-400" : "text-slate-500"}`}>
                            {row.nextExamTitle} · {row.nextExamDate ? fmt(row.nextExamDate) : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">Sin examen</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {row.daysUntilExam !== null ? (
                          <span className={`text-xs ${row.daysUntilExam <= 3 ? "text-red-400" : row.daysUntilExam <= 7 ? "text-amber-400" : "text-slate-500"}`}>
                            {row.daysUntilExam}d
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-4 text-right tabular-nums">
                        {row.tasksPerDay !== null && row.pendingTasks > 0 ? (
                          <span className={`text-xs font-medium ${isOverload ? "text-red-400" : "text-emerald-400"}`}>
                            {row.tasksPerDay} t/d
                          </span>
                        ) : row.pendingTasks === 0 ? (
                          <span className="text-xs text-emerald-600">✓</span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 2: GPA PONDERADO
      ══════════════════════════════════════════════════════════════════════ */}
      <Section
        title="GPA ponderado"
        subtitle="Promedio ponderado por créditos · solo materias con notas registradas"
        badge={weightedGPA !== null ? weightedGPA.toFixed(2) : undefined}
        badgeColor={weightedGPA !== null ? (weightedGPA >= 7 ? "emerald" : "amber") : undefined}
      >
        {gradedSubjects.length === 0 ? (
          <p className="text-sm text-slate-600 py-2">
            Registrá notas en Exámenes para ver tu GPA.
          </p>
        ) : (
          <div className="space-y-2.5">
            {subjectGPAs.map(g => (
              <div key={g.subjectId} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-52 truncate shrink-0">{g.subjectName}</span>
                <span className="text-xs text-slate-700 w-12 shrink-0 tabular-nums">{g.credits} cr</span>
                {g.weightedAvg !== null ? (
                  <>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${g.weightedAvg >= 7 ? "bg-emerald-500" : g.weightedAvg >= 4 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${(g.weightedAvg / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold tabular-nums w-8 text-right shrink-0 ${g.weightedAvg >= 7 ? "text-emerald-400" : g.weightedAvg >= 4 ? "text-amber-400" : "text-red-400"}`}>
                      {g.weightedAvg.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-700 w-12 text-right shrink-0 tabular-nums">
                      {g.gradedExams}/{g.totalExams}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-700 flex-1">Sin notas</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 3: DESVIACIÓN DE ENTREGA
      ══════════════════════════════════════════════════════════════════════ */}
      <Section title="Desviación de entrega" subtitle="Factor de procrastinación — diferencia entre fecha programada y fecha real de finalización">
        {deviation === null ? (
          <p className="text-sm text-slate-600 py-2">
            Completá tareas con fecha de vencimiento para ver tus métricas de puntualidad.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <DeviationCard
              label="Promedio días tarde"
              value={deviation.avgDaysLate === 0 ? "0" : deviation.avgDaysLate > 0 ? `+${deviation.avgDaysLate}` : `${deviation.avgDaysLate}`}
              note={deviation.avgDaysLate <= 0 ? "A tiempo o antes ✓" : deviation.avgDaysLate <= 2 ? "Retraso leve" : "Retraso considerable"}
              color={deviation.avgDaysLate <= 0 ? "emerald" : deviation.avgDaysLate <= 2 ? "amber" : "red"}
            />
            <DeviationCard
              label="% a tiempo"
              value={`${Math.round(deviation.onTimeRate * 100)}%`}
              note={`${Math.round(deviation.onTimeRate * 100) >= 80 ? "Muy puntual" : Math.round(deviation.onTimeRate * 100) >= 60 ? "Bastante puntual" : "Mejorar puntualidad"}`}
              color={deviation.onTimeRate >= 0.8 ? "emerald" : deviation.onTimeRate >= 0.6 ? "amber" : "red"}
            />
            <DeviationCard
              label="Muestra"
              value={`${deviation.sampleSize}`}
              note="tareas analizadas"
              color="slate"
            />
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 4: IEE — EFICIENCIA DE ESTUDIO
      ══════════════════════════════════════════════════════════════════════ */}
      <Section title="Índice de Eficiencia de Estudio (IEE)" subtitle="Nota / hora de estudio — qué materias te dan mayor retorno de inversión de tiempo">
        <StudyROIChart data={studyROI} />
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-xs text-slate-600 mb-4">Registrar sesión de estudio</p>
          <StudySessionLog subjects={subjects} today={today} />
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 5: SIMULADOR DE NOTAS
      ══════════════════════════════════════════════════════════════════════ */}
      <Section title="Simulador de notas" subtitle="¿Qué nota mínima necesitás en los próximos exámenes para llegar al promedio deseado?">
        <GradeSimulator subjects={gradeSimData} />
        {gradeSimData.length > 0 && (
          <p className="text-xs text-slate-700 mt-3">
            Ajustá el peso de cada examen desde la página de Exámenes para mayor precisión.
          </p>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN EXISTENTE: HEATMAP
      ══════════════════════════════════════════════════════════════════════ */}
      <Section title="Actividad — últimos 12 meses" subtitle={`${stats.totalDone} tareas completadas · racha ${stats.currentStreakDays}d`}>
        <ActivityHeatmap data={heatmapData} />
      </Section>

      {/* Tareas por materia */}
      <Section title="Tareas completadas por materia" subtitle="Últimas 8 semanas">
        <TasksBySubjectChart data={weeklyData} subjects={subjectNames} />
      </Section>

      {/* Notas */}
      {examGrades.length > 0 && (
        <Section title="Historial de notas" subtitle={`Promedio simple: ${(examGrades.reduce((s,e) => s+e.grade,0)/examGrades.length).toFixed(1)}`}>
          <ExamGradeChart data={examGrades} />
        </Section>
      )}

      {/* Cobertura */}
      {coverageData.length > 0 && (
        <Section title="Cobertura de apuntes" subtitle="Clases con resumen generado por IA">
          <div className="space-y-3">
            {coverageData.map(d => {
              const pct = Math.round((d.summarized / d.total) * 100);
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{d.name}</span>
                    <span className="text-xs text-slate-600 tabular-nums">{d.summarized}/{d.total} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Hábitos */}
      <Section title="Consistencia de hábitos — últimos 30 días" subtitle={`${activeHabits} hábito${activeHabits !== 1 ? "s" : ""} activo${activeHabits !== 1 ? "s" : ""}`}>
        <HabitConsistencyChart data={habitData} />
      </Section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: {
  label: string; value: number | string; accent?: "emerald" | "amber";
}) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-slate-100";
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, badge, badgeColor, children }: {
  title: string; subtitle?: string;
  badge?: string; badgeColor?: "emerald" | "amber";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
        {subtitle && <span className="text-xs text-slate-700 hidden sm:block">{subtitle}</span>}
        {badge && (
          <span className={`ml-auto text-lg font-black tabular-nums ${badgeColor === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        {children}
      </div>
    </section>
  );
}

function DeviationCard({ label, value, note, color }: {
  label: string; value: string; note: string;
  color: "emerald" | "amber" | "red" | "slate";
}) {
  const c = color === "emerald" ? "text-emerald-400"
          : color === "amber"   ? "text-amber-400"
          : color === "red"     ? "text-red-400"
          : "text-slate-400";
  return (
    <div className="text-center">
      <p className={`text-3xl font-black tabular-nums ${c}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      <p className="text-xs text-slate-700 mt-0.5">{note}</p>
    </div>
  );
}
