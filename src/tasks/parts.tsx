import { useState, type ReactNode } from "react";
import { today } from "../lib/storage";
import { PRIORITIES, type CuTask, type Domain } from "./types";
import { dayOf, dueLabel, navigate, useTasksState } from "./useTasks";

/** Code screen, setup message or errors, then the screen itself. */
export function Gate({ children }: { children: ReactNode }) {
  const t = useTasksState();
  const [code, setCode] = useState("");
  if (!t.code || t.error?.kind === "code") {
    return (
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) t.saveCode(code.trim());
        }}
      >
        <h2>Relier ClickUp</h2>
        <p className="small muted">
          Entre le code d'accès de l'app (celui mis dans Vercel sous TDAF_ACCESS_CODE). Il est gardé sur ce téléphone.
        </p>
        {t.error?.kind === "code" && t.code && <p className="error">Ce code n'est pas le bon.</p>}
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code d'accès" placeholder="Code d'accès" />
        <button className="primary" disabled={t.loading}>{t.loading ? "Connexion…" : "Relier"}</button>
      </form>
    );
  }
  if (t.error?.kind === "setup") {
    return (
      <div className="card stack tight">
        <h2>ClickUp pas encore configuré</h2>
        <p className="small">{t.error.message}</p>
      </div>
    );
  }
  return (
    <>
      {t.error && <p className="error">{t.error.message}</p>}
      {children}
    </>
  );
}

export function DomainFilter() {
  const t = useTasksState();
  const options: { id: Domain | "all"; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "pro", label: "Pro" },
    { id: "perso", label: "Perso" },
  ];
  return (
    <div className="row" role="group" aria-label="Pro ou perso">
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={t.domainFilter === o.id} onClick={() => t.setDomainFilter(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SyncLine() {
  const t = useTasksState();
  return (
    <p className="small muted row between">
      <span>
        {t.loading
          ? "Synchronisation avec ClickUp…"
          : t.syncedAt
            ? `ClickUp synchronisé à ${new Date(t.syncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
      </span>
      <button className="link" onClick={t.refresh} disabled={t.loading}>Actualiser</button>
    </p>
  );
}

export function TaskRow({ task, showList = true }: { task: CuTask; showList?: boolean }) {
  const t = useTasksState();
  const starred = t.top3.includes(task.id);
  const due = dueLabel(task.due);
  const late = task.due && dayOf(task.due) < today();
  const prio = task.priority && task.priority !== "normal" ? PRIORITIES.find((p) => p.id === task.priority)?.label : "";
  const subtasks = t.tasks.filter((x) => x.parent === task.id);
  return (
    <div className={task.closed ? "task-row done" : "task-row"}>
      <button
        className={task.closed ? "task-check checked" : "task-check"}
        aria-label={task.closed ? `Rouvrir « ${task.name} »` : `Terminer « ${task.name} »`}
        onClick={() => t.complete(task, !task.closed)}
      >
        {task.closed ? "✓" : ""}
      </button>
      <button
        className="task-main"
        onClick={() => {
          t.setFocusId(task.id);
          navigate("tasks", "now");
        }}
      >
        <span className="task-name">{task.name}</span>
        <span className="small muted">
          {[
            showList && t.pathOf(task),
            due && <span key="d" className={late ? "late" : undefined}>{due}</span>,
            prio && <span key="p" className={`prio ${task.priority}`}>{prio}</span>,
            subtasks.length > 0 && `${subtasks.filter((s) => s.closed).length}/${subtasks.length} étapes`,
          ]
            .filter(Boolean)
            .flatMap((x, i) => (i ? [" · ", x] : [x]))}
        </span>
      </button>
      <button
        className={starred ? "task-star on" : "task-star"}
        aria-label={starred ? "Retirer du top 3" : "Mettre dans le top 3 du jour"}
        aria-pressed={starred}
        onClick={() => t.toggleTop3(task.id)}
      >
        {starred ? "★" : "☆"}
      </button>
    </div>
  );
}
