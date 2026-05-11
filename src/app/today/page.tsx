import { getDb } from "@/lib/db";
import { CONTEXTS } from "@/lib/types";
import type { Task } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import TaskItem from "@/components/TaskItem";
import AddTaskInline from "@/components/AddTaskInline";

const PRIORITY_SORT = `CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 END`;

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function TodayPage() {
  const db = getDb();
  const today = localDateStr();

  const overdue = db
    .prepare(
      `SELECT * FROM tasks WHERE due_date < ? AND status = 'pendiente' ORDER BY ${PRIORITY_SORT}, created_at`
    )
    .all(today) as Task[];

  const todayTasks = db
    .prepare(
      `SELECT * FROM tasks WHERE due_date = ? ORDER BY status, ${PRIORITY_SORT}, created_at`
    )
    .all(today) as Task[];

  const overdueByContext = CONTEXTS.map((c) => ({
    ...c,
    tasks: overdue.filter((t) => t.context === c.slug),
  })).filter((c) => c.tasks.length > 0);

  const todayByContext = CONTEXTS.map((c) => ({
    ...c,
    tasks: todayTasks.filter((t) => t.context === c.slug),
  })).filter((c) => c.tasks.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">Hoy</h1>
        <p className="text-sm text-slate-500 mt-1">{formatDate(today)}</p>
      </div>

      {overdueByContext.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-4">
            Vencidas
          </h2>
          <div className="space-y-6">
            {overdueByContext.map((ctx) => (
              <div key={ctx.slug}>
                <p className="text-xs font-medium text-slate-500 mb-2">{ctx.label}</p>
                <div className="space-y-1">
                  {ctx.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} showDueDate />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Para hoy
        </h2>
        {todayByContext.length === 0 && (
          <p className="text-sm text-slate-600 py-2">No hay tareas para hoy.</p>
        )}
        <div className="space-y-6">
          {todayByContext.map((ctx) => (
            <div key={ctx.slug}>
              <p className="text-xs font-medium text-slate-500 mb-2">{ctx.label}</p>
              <div className="space-y-1">
                {ctx.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <AddTaskInline defaultDueDate={today} />
        </div>
      </section>
    </div>
  );
}
