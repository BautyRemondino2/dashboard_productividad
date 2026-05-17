import { getDb } from "@/lib/db";
import type { Subject } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import Link from "next/link";

interface SubjectStats {
  subject: Subject;
  materials: number;
  summaries: number;
  pendingMaterials: number;
  pendingTasks: number;
  upcomingExams: number;
  avgGrade: number | null;
}

export default function FacultadPage() {
  const db    = getDb();
  const today = localDateStr();

  // Only subjects in the active semester
  const activeSem = db
    .prepare("SELECT id FROM semesters WHERE status='active' ORDER BY id DESC LIMIT 1")
    .get() as { id: number } | undefined;
  const subjects = activeSem
    ? (db
        .prepare("SELECT * FROM subjects WHERE semester_id = ? ORDER BY name")
        .all(activeSem.id) as Subject[])
    : (db.prepare("SELECT * FROM subjects WHERE semester_id IS NULL ORDER BY name").all() as Subject[]);

  const stats: SubjectStats[] = subjects.map(subject => {
    const materials = (db.prepare(
      "SELECT COUNT(*) as n FROM class_materials WHERE subject_id = ?"
    ).get(subject.id) as { n: number }).n;

    const summaries = (db.prepare(
      "SELECT COUNT(*) as n FROM summaries WHERE subject_id = ?"
    ).get(subject.id) as { n: number }).n;

    const pendingTasks = (db.prepare(
      "SELECT COUNT(*) as n FROM tasks WHERE subject_id = ? AND status = 'pendiente'"
    ).get(subject.id) as { n: number }).n;

    const upcomingExams = (db.prepare(
      "SELECT COUNT(*) as n FROM exams WHERE subject_id = ? AND date >= ?"
    ).get(subject.id, today) as { n: number }).n;

    const gradeRow = db.prepare(
      "SELECT AVG(grade) as avg FROM exams WHERE subject_id = ? AND grade IS NOT NULL"
    ).get(subject.id) as { avg: number | null };

    return {
      subject,
      materials,
      summaries,
      pendingMaterials: materials - summaries,
      pendingTasks,
      upcomingExams,
      avgGrade: gradeRow.avg != null ? Math.round(gradeRow.avg * 10) / 10 : null,
    };
  });

  const totalMaterials = stats.reduce((s, r) => s + r.materials, 0);
  const totalSummaries = stats.reduce((s, r) => s + r.summaries, 0);
  const totalPending   = stats.reduce((s, r) => s + r.pendingMaterials, 0);
  const totalTasks     = stats.reduce((s, r) => s + r.pendingTasks, 0);
  const totalExams     = stats.reduce((s, r) => s + r.upcomingExams, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Facultad</h1>
        <p className="text-sm text-slate-500 mt-0.5">{subjects.length} materias</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Clases cargadas"   value={totalMaterials} />
        <StatCard label="Con resumen"        value={totalSummaries} accent={totalSummaries === totalMaterials && totalMaterials > 0 ? "emerald" : undefined} />
        <StatCard label="Sin resumir"        value={totalPending}   accent={totalPending > 0 ? "amber" : undefined} />
        <StatCard label="Exámenes próximos"  value={totalExams}     accent={totalExams > 0 ? "violet" : undefined} />
      </div>

      {totalTasks > 0 && (
        <div className="mb-4 px-3 py-2 bg-amber-950/30 border border-amber-800 rounded-lg flex items-center gap-2">
          <span className="text-amber-400 text-sm">⚠</span>
          <span className="text-sm text-amber-400">
            {totalTasks} tarea{totalTasks !== 1 ? "s" : ""} pendiente{totalTasks !== 1 ? "s" : ""} en materias
          </span>
        </div>
      )}

      {/* Subject cards */}
      <div className="space-y-3">
        {stats.map(({ subject, materials, summaries, pendingMaterials, pendingTasks, upcomingExams, avgGrade }) => (
          <Link
            key={subject.id}
            href={`/facultad/${subject.id}`}
            className="block bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-slate-100 group-hover:text-white transition-colors">
                  {subject.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {materials === 0 ? (
                    <span className="text-xs text-slate-600">Sin clases aún</span>
                  ) : (
                    <>
                      <span className="text-xs text-slate-500">{materials} clase{materials !== 1 ? "s" : ""}</span>
                      {pendingMaterials > 0 ? (
                        <span className="text-xs text-amber-500">· {pendingMaterials} sin resumir</span>
                      ) : (
                        <span className="text-xs text-emerald-600">· al día ✓</span>
                      )}
                    </>
                  )}
                  {pendingTasks > 0 && (
                    <span className="text-xs text-amber-400 font-medium">· {pendingTasks} tarea{pendingTasks !== 1 ? "s" : ""}</span>
                  )}
                  {upcomingExams > 0 && (
                    <span className="text-xs text-violet-400 font-medium">· {upcomingExams} examen{upcomingExams !== 1 ? "es" : ""}</span>
                  )}
                  {avgGrade != null && (
                    <span className={`text-xs font-medium ${avgGrade >= 7 ? "text-emerald-500" : avgGrade >= 4 ? "text-amber-500" : "text-red-500"}`}>
                      · promedio {avgGrade}
                    </span>
                  )}
                </div>
              </div>

              {/* Coverage progress bar */}
              {materials > 0 && (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] text-slate-600">{summaries}/{materials}</span>
                  <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${summaries === materials ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${materials > 0 ? (summaries / materials) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: {
  label: string;
  value: number;
  accent?: "emerald" | "amber" | "violet";
}) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "amber"  ? "text-amber-400"
    : accent === "violet" ? "text-violet-400"
    : "text-slate-100";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
