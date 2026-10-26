import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google, type calendar_v3 } from "googleapis";

interface BlockTask {
  id: string;
  name: string;
  minutes: number;
  /** Google Calendar event color, "1" to "11". */
  colorId: string;
  project: string;
  url: string;
}

interface SyncDay {
  date: string;
  /** Work window of that day, ISO with time zone. */
  from: string;
  to: string;
  /** Local midnight to midnight of that day, ISO: the server runs in UTC. */
  dayStart: string;
  dayEnd: string;
  tasks: BlockTask[];
}

interface DayWindow {
  from: string;
  to: string;
  dayStart: string;
  dayEnd: string;
}

type Api = calendar_v3.Calendar;
type Event = calendar_v3.Schema$Event;
type Busy = { start: number; end: number }[];

const BREAK_MS = 10 * 60_000;
const STEP_MS = 15 * 60_000;
/** How far ahead the app's blocks are looked for. */
const HORIZON_MS = 120 * 86_400_000;

function calendar() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as { client_email: string };
  const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/calendar"] });
  return { api: google.calendar({ version: "v3", auth }), email: key.client_email };
}

const ms = (d?: calendar_v3.Schema$EventDateTime) => new Date(d?.dateTime ?? d?.date ?? 0).getTime();

/** Earliest start from `from` where the block fits before `to` without overlapping. */
function findSlot(busy: Busy, from: number, to: number, length: number) {
  let start = Math.ceil(from / STEP_MS) * STEP_MS;
  while (start + length <= to) {
    const clash = busy.find((b) => b.start < start + length && b.end > start);
    if (!clash) return start;
    start = Math.ceil(clash.end / STEP_MS) * STEP_MS;
  }
  return null;
}

/** The app's blocks still to come (a block already started stays as a record), by task. */
async function futureBlocks(api: Api, calendarId: string, taskId?: string) {
  const all: Event[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await api.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + HORIZON_MS).toISOString(),
      privateExtendedProperty: taskId ? ["tdaf=1", `taskId=${taskId}`] : ["tdaf=1"],
      singleEvents: true,
      maxResults: 2500,
      pageToken,
    });
    all.push(...(data.items ?? []).filter((e) => ms(e.start) >= Date.now()));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  const byTask = new Map<string, Event[]>();
  for (const e of all) {
    const id = e.extendedProperties?.private?.taskId ?? "";
    byTask.set(id, [...(byTask.get(id) ?? []), e]);
  }
  return byTask;
}

/** What the block shows; its time is set separately. */
const body = (t: BlockTask): Event => ({
  summary: t.name,
  description: `Projet : ${t.project}\nClickUp : ${t.url}\n\nBloc de travail planifié par TDA Fighter. Tu peux le déplacer : il restera lié à la tâche.`,
  colorId: t.colorId,
  extendedProperties: { private: { tdaf: "1", taskId: t.id } },
  transparency: "opaque",
});

const when = (start: number, length: number, timeZone?: string) => ({
  start: { dateTime: new Date(start).toISOString(), timeZone },
  end: { dateTime: new Date(start + length).toISOString(), timeZone },
});

/**
 * Week sync. Each task has at most one future block, found by its task id:
 * it is updated (and kept where it is if it's already on the right day, even if moved by hand),
 * moved when the task changed day, created only when missing. Blocks of tasks no longer planned
 * on these days are removed. Other events are never touched.
 */
async function sync(api: Api, calendarId: string, days: SyncDay[], timeZone?: string) {
  const timeMin = days[0].from;
  const timeMax = days[days.length - 1].to;
  const blocks = await futureBlocks(api, calendarId);
  const planned = new Set(days.flatMap((d) => d.tasks.map((t) => t.id)));
  const rangeStart = new Date(days[0].dayStart).getTime();
  const rangeEnd = new Date(days[days.length - 1].dayEnd).getTime();
  let created = 0;
  let updated = 0;
  let removed = 0;

  // Blocks in these days whose task is no longer planned there, and duplicates, go away.
  for (const [taskId, events] of blocks) {
    const [keep, ...extra] = events.sort((a, b) => ms(a.start) - ms(b.start));
    const gone = [...extra, ...(!planned.has(taskId) && ms(keep.start) >= rangeStart && ms(keep.start) < rangeEnd ? [keep] : [])];
    for (const e of gone) {
      await api.events.delete({ calendarId, eventId: e.id! });
      removed++;
    }
    if (gone.includes(keep)) blocks.delete(taskId);
    else blocks.set(taskId, [keep]);
  }

  // Busy time, without the app's own blocks: they are placed below.
  const own = [...blocks.values()].flat();
  const { data: fb } = await api.freebusy.query({ requestBody: { timeMin, timeMax, items: [{ id: calendarId }] } });
  const busy: Busy = (fb.calendars?.[calendarId]?.busy ?? [])
    .map((b) => ({ start: new Date(b.start!).getTime(), end: new Date(b.end!).getTime() }))
    .filter((b) => !own.some((e) => ms(e.start) === b.start && ms(e.end) === b.end));

  const unplaced: string[] = [];
  for (const day of days) {
    const dayStart = new Date(day.dayStart).getTime();
    const dayEnd = new Date(day.dayEnd).getTime();
    // First the blocks already on this day, where they are.
    const stays = day.tasks.filter((t) => {
      const e = blocks.get(t.id)?.[0];
      return e && ms(e.start) >= dayStart && ms(e.start) < dayEnd;
    });
    for (const t of stays) {
      const e = blocks.get(t.id)![0];
      const start = ms(e.start);
      const length = t.minutes * 60_000;
      await api.events.patch({ calendarId, eventId: e.id!, requestBody: { ...body(t), ...when(start, length, timeZone) } });
      busy.push({ start, end: start + length + BREAK_MS });
      updated++;
    }
    // Then the others, in plan order, in the free slots.
    let cursor = Math.max(new Date(day.from).getTime(), Date.now());
    const end = new Date(day.to).getTime();
    for (const t of day.tasks.filter((x) => !stays.includes(x))) {
      const length = Math.max(15, t.minutes) * 60_000;
      const start = findSlot(busy, cursor, end, length);
      const existing = blocks.get(t.id)?.[0];
      if (start === null) {
        unplaced.push(t.id);
        continue;
      }
      if (existing) {
        await api.events.patch({ calendarId, eventId: existing.id!, requestBody: { ...body(t), ...when(start, length, timeZone) } });
        updated++;
      } else {
        await api.events.insert({ calendarId, requestBody: { ...body(t), ...when(start, length, timeZone) } });
        created++;
      }
      busy.push({ start, end: start + length + BREAK_MS });
      cursor = start + length + BREAK_MS;
    }
  }
  return { created, updated, removed, unplaced };
}

/**
 * A task changed in the app: its future block follows. Done: the block is removed.
 * New day: it moves to a free slot of that day. Otherwise title, color and length are updated.
 * A task without a block gets none here; blocks are made by the week sync.
 */
async function followTask(
  api: Api,
  calendarId: string,
  task: BlockTask & { closed?: boolean; due?: string },
  window?: DayWindow,
  timeZone?: string,
) {
  const events = (await futureBlocks(api, calendarId, task.id)).get(task.id) ?? [];
  if (!events.length) return { changed: 0 };
  const [block, ...extra] = events.sort((a, b) => ms(a.start) - ms(b.start));
  for (const e of task.closed ? events : extra) await api.events.delete({ calendarId, eventId: e.id! });
  if (task.closed) return { changed: events.length };

  const length = Math.max(15, task.minutes) * 60_000;
  let start = ms(block.start);
  if (task.due && window) {
    const sameDay = start >= new Date(window.dayStart).getTime() && start < new Date(window.dayEnd).getTime();
    if (!sameDay) {
      const { data: fb } = await api.freebusy.query({
        requestBody: { timeMin: window.from, timeMax: window.to, items: [{ id: calendarId }] },
      });
      const busy = (fb.calendars?.[calendarId]?.busy ?? []).map((b) => ({
        start: new Date(b.start!).getTime(),
        end: new Date(b.end!).getTime() + BREAK_MS,
      }));
      const from = new Date(window.from).getTime();
      start = findSlot(busy, Math.max(from, Date.now()), new Date(window.to).getTime(), length) ?? from;
    }
  }
  await api.events.patch({ calendarId, eventId: block.id!, requestBody: { ...body(task), ...when(start, length, timeZone) } });
  return { changed: 1 + extra.length };
}

/**
 * Work blocks in Google Calendar, one color per project. The calendar is shared with the
 * service account of GOOGLE_SERVICE_ACCOUNT_JSON; the blocks carry the ClickUp task id.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const missing = ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CALENDAR_ID", "TDAF_ACCESS_CODE"].filter((k) => !process.env[k]?.trim());
  if (missing.length) return res.status(503).send(`Google Agenda n'est pas encore configuré : il manque ${missing.join(", ")} dans Vercel.`);
  if (String(req.headers["x-tdaf-code"] ?? "").trim() !== process.env.TDAF_ACCESS_CODE!.trim()) {
    return res.status(401).send("Code d'accès incorrect.");
  }

  const { api, email } = calendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!.trim();
  const { action, days, task, window, timeZone } = req.body as {
    action: string;
    days?: SyncDay[];
    task?: BlockTask & { closed?: boolean; due?: string };
    window?: DayWindow;
    timeZone?: string;
  };

  try {
    if (action === "status") return res.json({ serviceAccount: email });
    if (action === "sync" && days?.length) return res.json(await sync(api, calendarId, days, timeZone));
    if (action === "task" && task) return res.json(await followTask(api, calendarId, task, window, timeZone));
    return res.status(400).send("Action inconnue.");
  } catch (err) {
    console.error(err);
    const status = (err as { code?: number }).code;
    if (status === 404 || status === 403) {
      return res
        .status(502)
        .send(`Google Agenda refuse l'accès. Partage ton agenda avec ${email} (droit « Modifier les événements ») et active l'API Google Calendar.`);
    }
    res.status(500).send("Google Agenda est indisponible.");
  }
}
