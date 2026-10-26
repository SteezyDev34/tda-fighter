import { useEffect, useState } from "react";
import { shiftDate, today } from "../lib/storage";
import { CaptureBox, DomainFilter, Gate, SyncLine, TaskRow } from "./parts";
import { priorityRank, type CuTask } from "./types";
import { dayOf, streak, useTasksState } from "./useTasks";

const byPriority = (a: CuTask, b: CuTask) =>
  priorityRank(a.priority) - priorityRank(b.priority) || (a.due ?? 0) - (b.due ?? 0);

function Group({ title, tasks, limit, tone }: { title: string; tasks: CuTask[]; limit?: number; tone?: string }) {
  const [all, setAll] = useState(!limit);
  if (!tasks.length) return null;
  const shown = all ? tasks : tasks.slice(0, limit);
  return (
    <div className="card stack tight">
      <div className="row between">
        <h2 className={tone}>{title}</h2>
        <span className="pill">{tasks.length}</span>
      </div>
      {shown.map((x) => <TaskRow key={x.id} task={x} />)}
      {tasks.length > shown.length && (
        <button className="link start" onClick={() => setAll(true)}>Voir les {tasks.length - shown.length} autres</button>
      )}
    </div>
  );
}

export function TodayPage() {
  const t = useTasksState();
  useEffect(() => t.ensureFresh(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const d = today();
  const week = shiftDate(d, 7);
  const mine = t.tasks.filter((x) => !x.parent && t.inFilter(x));
  const open = mine.filter((x) => !x.closed && !t.top3.includes(x.id));
  const top = t.top3.map((id) => t.tasks.find((x) => x.id === id)).filter((x): x is CuTask => !!x);
  const late = open.filter((x) => x.due && dayOf(x.due) < d).sort(byPriority);
  const todays = open.filter((x) => x.due && dayOf(x.due) === d).sort(byPriority);
  const soon = open.filter((x) => x.due && dayOf(x.due) > d && dayOf(x.due) <= week).sort((a, b) => a.due! - b.due!);
  const later = open.filter((x) => x.due && dayOf(x.due) > week).sort((a, b) => a.due! - b.due!);
  const undated = open.filter((x) => !x.due).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.updated - a.updated);
  const doneToday = t.doneDays[d] ?? 0;
  const days = streak(t.doneDays);

  return (
    <section className="stack">
      <h1>Aujourd'hui</h1>
      <Gate>
        <DomainFilter />
        <p className="small">
          <strong>{doneToday}</strong> tâche{doneToday > 1 ? "s" : ""} faite{doneToday > 1 ? "s" : ""} aujourd'hui
          {days > 0 && <> · série de <strong>{days}</strong> jour{days > 1 ? "s" : ""} 🔥</>}
        </p>
        <CaptureBox />

        <div className="card stack tight">
          <div className="row between">
            <h2>Mon top 3</h2>
            <span className="pill">{top.filter((x) => x.closed).length}/{top.length || 3}</span>
          </div>
          {top.map((x) => <TaskRow key={x.id} task={x} />)}
          {top.length < 3 && (
            <p className="small muted">
              Touche ☆ sur {top.length ? "une autre tâche" : "une tâche"} pour la mettre dans ton top 3. Trois maximum : le reste peut attendre.
            </p>
          )}
        </div>

        <Group title="En retard" tasks={late} limit={5} tone="late" />
        <Group title="Pour aujourd'hui" tasks={todays} />
        <Group title="Cette semaine" tasks={soon} limit={5} />
        <Group title="Sans date" tasks={undated} limit={5} />
        <Group title="Plus tard" tasks={later} limit={3} />
        <SyncLine />
      </Gate>
    </section>
  );
}
