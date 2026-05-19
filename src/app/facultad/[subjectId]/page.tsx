import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { localDateStr } from "@/lib/utils";
import type { Subject, ClassItem, Exam, Task, ClassMaterial } from "@/lib/types";
import Link from "next/link";
import MateriaWorkspace from "@/components/MateriaWorkspace";

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const db = getDb();
  const today = localDateStr();

  const subject = db
    .prepare("SELECT * FROM subjects WHERE id = ?")
    .get(Number(subjectId)) as Subject | undefined;

  if (!subject) notFound();

  const classes = db
    .prepare("SELECT * FROM classes WHERE subject_id = ? ORDER BY week ASC")
    .all(subject.id) as ClassItem[];

  const exams = db
    .prepare("SELECT * FROM exams WHERE subject_id = ? ORDER BY date ASC")
    .all(subject.id) as Exam[];

  const allTasks = db
    .prepare(
      `SELECT t.* FROM tasks t WHERE t.subject_id = ?
       ORDER BY CASE t.status WHEN 'pendiente' THEN 0 ELSE 1 END,
                CASE t.priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
                t.due_date ASC`
    )
    .all(subject.id) as Task[];

  const allMaterials = db
    .prepare("SELECT * FROM class_materials WHERE subject_id = ? ORDER BY kind, filename")
    .all(subject.id) as ClassMaterial[];

  const materialsByClass: Record<number, ClassMaterial[]> = {};
  const inboxMaterials: ClassMaterial[] = [];
  for (const m of allMaterials) {
    if (m.class_id === null) inboxMaterials.push(m);
    else {
      if (!materialsByClass[m.class_id]) materialsByClass[m.class_id] = [];
      materialsByClass[m.class_id].push(m);
    }
  }

  const tasksByClass: Record<number, Task[]> = {};
  for (const t of allTasks) {
    const cid = t.material_id;
    if (cid == null) continue;
    if (!tasksByClass[cid]) tasksByClass[cid] = [];
    tasksByClass[cid].push(t);
  }

  const upcomingExams = exams.filter(e => e.date >= today && e.grade === null);

  return (
    <>
      <div className="px-8 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>
      <MateriaWorkspace
        subject={subject}
        classes={classes}
        materialsByClass={materialsByClass}
        tasksByClass={tasksByClass}
        inboxMaterials={inboxMaterials}
        upcomingExams={upcomingExams}
        today={today}
      />
    </>
  );
}
