import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google, type calendar_v3 } from "googleapis";

interface SyncTask {
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
  tasks: SyncTask[];
}

const BREAK_MS = 10 * 60_000;
const STEP_MS = 15 * 60_000;
/** Marks the events made by the app, to redo them without touching the others. */
const MARK = { tdaf: "1" };

function calendar() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as { client_email: string };
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return { api: google.calendar({ version: "v3", auth }), email: key.client_email };
}

type Busy = { start: number; end: number }[];

/** Earliest start from `from` where the block fits before `to` without overlapping. */
function findSlot(busy: Busy, from: number, to: number, ms: number) {
  let start = Math.ceil(from / STEP_MS) * STEP_MS;
  while (start + ms <= to) {
    const clash = busy.find((b) => b.start < start + ms && b.end > start);
    if (!clash) return start;
    start = Math.ceil(clash.end / STEP_MS) * STEP_MS;
  }
  return null;
}

/**
 * Puts the week's tasks in Google Calendar as work blocks, one color per project,
 * in the free time of each day's work window. The calendar is shared with the
 * service account of GOOGLE_SERVICE_ACCOUNT_JSON; the app's own events are redone each time.
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
  const { action, days, timeZone } = req.body as { action: string; days?: SyncDay[]; timeZone?: string };

  try {
    if (action === "status") return res.json({ serviceAccount: email });
    if (action !== "sync" || !days?.length) return res.status(400).send("Action inconnue.");

    const timeMin = days[0].from;
    const timeMax = days[days.length - 1].to;

    // 1. Remove the blocks made last time on these days.
    const old: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await api.events.list({
        calendarId,
        timeMin,
        timeMax,
        privateExtendedProperty: ["tdaf=1"],
        singleEvents: true,
        pageToken,
      });
      old.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
    for (const e of old) await api.events.delete({ calendarId, eventId: e.id! });

    // 2. What is already in the calendar.
    const { data: fb } = await api.freebusy.query({ requestBody: { timeMin, timeMax, items: [{ id: calendarId }] } });
    const busy: Busy = (fb.calendars?.[calendarId]?.busy ?? []).map((b) => ({
      start: new Date(b.start!).getTime(),
      end: new Date(b.end!).getTime(),
    }));

    // 3. Each task in the first free slot of its day, with a break after it.
    let created = 0;
    const unplaced: string[] = [];
    for (const day of days) {
      let cursor = Math.max(new Date(day.from).getTime(), Date.now());
      const end = new Date(day.to).getTime();
      for (const task of day.tasks) {
        const ms = Math.max(15, task.minutes) * 60_000;
        const start = findSlot(busy, cursor, end, ms);
        if (start === null) {
          unplaced.push(task.id);
          continue;
        }
        await api.events.insert({
          calendarId,
          requestBody: {
            summary: task.name,
            description: `Projet : ${task.project}\nClickUp : ${task.url}\n\nBloc de travail planifié par TDA Fighter.`,
            colorId: task.colorId,
            start: { dateTime: new Date(start).toISOString(), timeZone },
            end: { dateTime: new Date(start + ms).toISOString(), timeZone },
            extendedProperties: { private: { ...MARK, taskId: task.id } },
            transparency: "opaque",
          },
        });
        created++;
        busy.push({ start, end: start + ms + BREAK_MS });
        cursor = start + ms + BREAK_MS;
      }
    }
    res.json({ created, removed: old.length, unplaced, serviceAccount: email });
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
