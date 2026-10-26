import { createContext, useCallback, useContext, useState } from "react";
import { shiftDate, today } from "../lib/storage";
import { usePersisted } from "../nutrition/useNutrition";
import type { CuSpace, CuTask, Domain, Priority } from "./types";

/** Error the screens show differently: no code yet, or ClickUp not set up. */
export type TasksError = { kind: "code" | "setup" | "other"; message: string };

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Day "YYYY-MM-DD" of a ClickUp date in ms, in local time. */
export const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Noon of a local day, in ms: ClickUp stores dates without time this way. */
export const msOf = (day: string) => new Date(`${day}T12:00:00`).getTime();

export function useTasks() {
  const [code, setCode] = usePersisted("clickup-code", "");
  const [spaces, setSpaces] = usePersisted<CuSpace[]>("clickup-spaces", []);
  const [tasks, setTasks] = usePersisted<CuTask[]>("clickup-tasks", []);
  const [syncedAt, setSyncedAt] = usePersisted<string | null>("clickup-synced", null);
  /** Spaces counted as personal; the others are pro. */
  const [persoSpaces, setPersoSpaces] = usePersisted<string[] | null>("task-perso-spaces", null);
  const [captureLists, setCaptureLists] = usePersisted<Partial<Record<Domain, string>>>("task-capture-lists", {});
  const [domainFilter, setDomainFilter] = usePersisted<Domain | "all">("task-domain", "all");
  /** Up to 3 task ids chosen for each day. */
  const [top3, setTop3] = usePersisted<Record<string, string[]>>("task-top3", {});
  /** Days on which tasks were completed, with how many. */
  const [doneDays, setDoneDays] = usePersisted<Record<string, number>>("task-done-days", {});
  /** The task chosen for « Maintenant ». */
  const [focusId, setFocusId] = usePersisted<string | null>("task-focus", null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TasksError | null>(null);

  const call = useCallback(
    async <T,>(body: Record<string, unknown>, withCode = code): Promise<T> => {
      const res = await fetch("/api/clickup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tdaf-code": withCode },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new ApiError(res.status, await res.text());
      return (await res.json()) as T;
    },
    [code],
  );

  const fail = (e: unknown) => {
    const status = e instanceof ApiError ? e.status : 0;
    setError({
      kind: status === 401 ? "code" : status === 503 ? "setup" : "other",
      message: (e as Error).message,
    });
  };

  const refresh = useCallback(
    async (withCode = code) => {
      if (!withCode) return setError({ kind: "code", message: "" });
      setLoading(true);
      try {
        const [s, t] = await Promise.all([
          call<{ spaces: CuSpace[] }>({ action: "structure" }, withCode),
          call<{ tasks: CuTask[] }>({ action: "tasks" }, withCode),
        ]);
        setSpaces(s.spaces);
        setTasks(t.tasks);
        setSyncedAt(new Date().toISOString());
        setError(null);
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [call, code],
  );

  /** Called when a task screen opens: reloads if the data is over a minute old. */
  const ensureFresh = () => {
    if (!loading && (!syncedAt || Date.now() - new Date(syncedAt).getTime() > 60_000)) refresh();
  };

  const saveCode = (c: string) => {
    setCode(c);
    refresh(c);
  };

  const perso = persoSpaces ?? spaces.filter((s) => /perso/i.test(s.name)).map((s) => s.id);
  const domainOf = (spaceId: string): Domain => (perso.includes(spaceId) ? "perso" : "pro");
  /** "SPACE › Folder › List", without a list just called "List". */
  const pathOf = (x: CuTask) => {
    const space = spaces.find((s) => s.id === x.spaceId)?.name;
    const list = /^list[e]?$/i.test(x.listName) && (space || x.folderName) ? undefined : x.listName;
    return [space, x.folderName, list].filter(Boolean).join(" › ");
  };
  const inFilter = (t: CuTask) => domainFilter === "all" || domainOf(t.spaceId) === domainFilter;

  const put = (task: CuTask) =>
    setTasks((all) => (all.some((t) => t.id === task.id) ? all.map((t) => (t.id === task.id ? task : t)) : [...all, task]));

  /** Runs a change on ClickUp; the screen keeps working if it fails. */
  const run = async <T,>(fn: () => Promise<T>) => {
    try {
      const r = await fn();
      setError(null);
      return r;
    } catch (e) {
      fail(e);
      return undefined;
    }
  };

  const complete = (task: CuTask, done = true) =>
    run(async () => {
      // Shown done at once: finishing should feel instant.
      put({ ...task, closed: done });
      const { task: updated } = await call<{ task: CuTask }>({ action: "complete", taskId: task.id, done });
      put(updated);
      const d = today();
      setDoneDays((all) => ({ ...all, [d]: Math.max(0, (all[d] ?? 0) + (done ? 1 : -1)) }));
      return updated;
    }).then((r) => {
      if (!r) put(task);
      return r;
    });

  const create = (listId: string, name: string, extra: { due?: number; priority?: Priority; parent?: string } = {}) =>
    run(async () => {
      const { task } = await call<{ task: CuTask }>({ action: "create", listId, name, ...extra });
      put(task);
      return task;
    });

  const update = (task: CuTask, patch: { due?: number | null; priority?: Priority | null; estimate?: number | null }) =>
    run(async () => {
      // null removes a value, undefined keeps it.
      const pick = <K extends "due" | "priority" | "estimate">(k: K) =>
        (patch[k] === null ? undefined : (patch[k] ?? task[k])) as CuTask[K];
      put({ ...task, due: pick("due"), priority: pick("priority"), estimate: pick("estimate") });
      const { task: updated } = await call<{ task: CuTask }>({ action: "update", taskId: task.id, ...patch });
      put(updated);
      return updated;
    });

  const logTime = (task: CuTask, start: number, duration: number) =>
    run(() => call({ action: "time", taskId: task.id, start, duration }));

  const toggleTop3 = (id: string) => {
    const d = today();
    setTop3((all) => {
      const day = all[d] ?? [];
      return { ...all, [d]: day.includes(id) ? day.filter((x) => x !== id) : [...day, id].slice(-3) };
    });
  };

  return {
    code,
    saveCode,
    spaces,
    tasks,
    syncedAt,
    loading,
    error,
    refresh: () => refresh(),
    ensureFresh,
    perso,
    setPersoSpaces,
    domainOf,
    pathOf,
    inFilter,
    domainFilter,
    setDomainFilter,
    captureLists,
    setCaptureLists,
    focusId,
    setFocusId,
    top3: top3[today()] ?? [],
    toggleTop3,
    doneDays,
    complete,
    create,
    update,
    logTime,
  };
}

export type TasksState = ReturnType<typeof useTasks>;

/** One ClickUp state for the whole app, so the task tabs share it. */
export const TasksContext = createContext<TasksState | null>(null);
export const useTasksState = () => useContext(TasksContext)!;

/** Consecutive days with at least one task done, up to today (or yesterday). */
export function streak(doneDays: Record<string, number>) {
  const d = new Date();
  if (!doneDays[dayOf(d.getTime())]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (doneDays[dayOf(d.getTime())]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Asks another tab to open (handled in App). */
export const navigate = (section: string, tab: string) =>
  window.dispatchEvent(new CustomEvent("tdaf:navigate", { detail: { section, tab } }));

export function dueLabel(due?: number) {
  if (!due) return "";
  const day = dayOf(due);
  const t = today();
  if (day < t) {
    const days = Math.round((msOf(t) - msOf(day)) / 86_400_000);
    return `En retard (${days} j)`;
  }
  if (day === t) return "Aujourd'hui";
  if (day === shiftDate(t, 1)) return "Demain";
  const d = new Date(due);
  return day <= shiftDate(t, 6)
    ? d.toLocaleDateString("fr-FR", { weekday: "long" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
