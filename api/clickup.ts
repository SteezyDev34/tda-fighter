import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { CuList, CuSpace, CuTask } from "../src/tasks/types";

const BASE = "https://api.clickup.com/api/v2";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function cu<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: process.env.CLICKUP_TOKEN!, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new HttpError(res.status === 401 ? 502 : res.status, `ClickUp ${res.status} : ${await res.text()}`);
  return (await res.json()) as T;
}

/** The workspace: the token's first one, unless CLICKUP_TEAM_ID says which. */
async function teamId() {
  if (process.env.CLICKUP_TEAM_ID) return process.env.CLICKUP_TEAM_ID;
  const { teams } = await cu<{ teams: { id: string }[] }>("/team");
  if (!teams.length) throw new HttpError(404, "Aucun espace de travail ClickUp.");
  return teams[0].id;
}

interface RawList {
  id: string;
  name: string;
  task_count?: number;
}

async function structure(): Promise<{ teamId: string; spaces: CuSpace[] }> {
  const team = await teamId();
  const { spaces } = await cu<{ spaces: { id: string; name: string }[] }>(`/team/${team}/space?archived=false`);
  const full = await Promise.all(
    spaces.map(async (s) => {
      const [{ folders }, { lists }] = await Promise.all([
        cu<{ folders: { id: string; name: string; lists: RawList[] }[] }>(`/space/${s.id}/folder?archived=false`),
        cu<{ lists: RawList[] }>(`/space/${s.id}/list?archived=false`),
      ]);
      const toList = (l: RawList, folder?: string): CuList => ({ id: l.id, name: l.name, folder });
      return {
        id: s.id,
        name: s.name,
        lists: [...lists.map((l) => toList(l)), ...folders.flatMap((f) => f.lists.map((l) => toList(l, f.name)))],
      };
    }),
  );
  return { teamId: team, spaces: full };
}

interface RawTask {
  id: string;
  name: string;
  text_content?: string;
  status: { status: string; type: string; color: string };
  due_date: string | null;
  start_date: string | null;
  priority: { priority: string } | null;
  parent: string | null;
  list: { id: string; name: string };
  folder?: { name: string; hidden?: boolean };
  space: { id: string };
  url: string;
  date_updated: string;
  time_estimate?: number | null;
}

const toTask = (t: RawTask): CuTask => ({
  id: t.id,
  name: t.name,
  description: t.text_content?.slice(0, 2000) || undefined,
  status: t.status.status,
  closed: t.status.type === "closed" || t.status.type === "done",
  due: t.due_date ? Number(t.due_date) : undefined,
  priority: (t.priority?.priority as CuTask["priority"]) ?? undefined,
  parent: t.parent ?? undefined,
  listId: t.list.id,
  listName: t.list.name,
  folderName: t.folder && !t.folder.hidden ? t.folder.name : undefined,
  spaceId: t.space.id,
  url: t.url,
  updated: Number(t.date_updated),
  estimate: t.time_estimate ?? undefined,
});

/** Every open task of the workspace, subtasks included (up to 1000). */
async function tasks() {
  const team = await teamId();
  const all: CuTask[] = [];
  for (let page = 0; page < 10; page++) {
    const { tasks, last_page } = await cu<{ tasks: RawTask[]; last_page?: boolean }>(
      `/team/${team}/task?page=${page}&subtasks=true&include_closed=false&order_by=due_date`,
    );
    all.push(...tasks.map(toTask));
    if (last_page || tasks.length < 100) break;
  }
  return all;
}

/** Statuses differ per list: finds the list's "done" status. */
async function complete(taskId: string, done: boolean) {
  const task = await cu<RawTask>(`/task/${taskId}`);
  const list = await cu<{ statuses: { status: string; type: string; orderindex: number }[] }>(`/list/${task.list.id}`);
  const sorted = [...list.statuses].sort((a, b) => a.orderindex - b.orderindex);
  const target = done
    ? (sorted.find((s) => s.type === "closed") ?? sorted.find((s) => s.type === "done"))
    : sorted.find((s) => s.type === "open");
  if (!target) throw new HttpError(409, "Cette liste n'a pas de statut « terminé ».");
  return toTask(await cu<RawTask>(`/task/${taskId}`, { method: "PUT", body: { status: target.status } }));
}

const PRIORITY = { urgent: 1, high: 2, normal: 3, low: 4 } as const;

/**
 * Proxy between the app and ClickUp. The ClickUp token stays on the server;
 * the app sends the access code set in TDAF_ACCESS_CODE.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  // Names only, never values: says which variable this deployment doesn't see.
  const missing = ["CLICKUP_TOKEN", "TDAF_ACCESS_CODE"].filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    return res
      .status(503)
      .send(
        `Ce déploiement ne voit pas ${missing.join(" ni ")} (env : ${process.env.VERCEL_ENV ?? "?"}). ` +
          "Vérifie dans Vercel que la variable est cochée pour Production, puis redéploie.",
      );
  }
  if (req.headers["x-tdaf-code"] !== process.env.TDAF_ACCESS_CODE) {
    return res.status(401).send("Code d'accès incorrect.");
  }

  const body = req.body as {
    action: string;
    taskId?: string;
    done?: boolean;
    listId?: string;
    name?: string;
    description?: string;
    due?: number | null;
    priority?: keyof typeof PRIORITY | null;
    parent?: string;
    start?: number;
    duration?: number;
    /** Time estimate in ms, null to remove it. */
    estimate?: number | null;
  };

  try {
    switch (body.action) {
      case "structure":
        return res.json(await structure());
      case "tasks":
        return res.json({ tasks: await tasks() });
      case "create": {
        if (!body.listId || !body.name?.trim()) throw new HttpError(400, "Liste et nom obligatoires.");
        const task = await cu<RawTask>(`/list/${body.listId}/task`, {
          method: "POST",
          body: {
            name: body.name.trim(),
            description: body.description,
            due_date: body.due ?? undefined,
            due_date_time: false,
            priority: body.priority ? PRIORITY[body.priority] : undefined,
            parent: body.parent,
          },
        });
        return res.json({ task: toTask(task) });
      }
      case "complete":
        if (!body.taskId) throw new HttpError(400, "Tâche manquante.");
        return res.json({ task: await complete(body.taskId, body.done !== false) });
      case "update": {
        if (!body.taskId) throw new HttpError(400, "Tâche manquante.");
        const patch: Record<string, unknown> = {};
        if (body.name) patch.name = body.name;
        if (body.due !== undefined) Object.assign(patch, { due_date: body.due, due_date_time: false });
        if (body.priority !== undefined) patch.priority = body.priority ? PRIORITY[body.priority] : null;
        if (body.estimate !== undefined) patch.time_estimate = body.estimate;
        const task = await cu<RawTask>(`/task/${body.taskId}`, { method: "PUT", body: patch });
        return res.json({ task: toTask(task) });
      }
      case "time": {
        // A focus session is logged as time spent on the task.
        if (!body.taskId || !body.start || !body.duration) throw new HttpError(400, "Session incomplète.");
        const team = await teamId();
        await cu(`/team/${team}/time_entries`, {
          method: "POST",
          body: { tid: body.taskId, start: body.start, duration: body.duration, description: "Focus TDA Fighter" },
        });
        return res.json({ ok: true });
      }
      default:
        return res.status(400).send("Action inconnue.");
    }
  } catch (err) {
    console.error(err);
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).send(status === 500 ? "ClickUp est indisponible." : (err as Error).message);
  }
}
