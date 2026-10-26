import { shiftDate, today } from "../lib/storage";
import type { CuTask, Priority } from "./types";
import { dayOf } from "./useTasks";

/** Time blindness: what we estimate usually takes half as long again. */
export const BUFFER = 1.5;
/** Share of the free hours that can be planned; the rest absorbs the unexpected. */
export const FILL = 0.7;
/** Default free hours for tasks, Monday to Sunday. */
export const DEFAULT_HOURS = [3, 3, 3, 3, 3, 2, 1];
/** Counted when a task has no estimate. */
export const DEFAULT_MIN = 30;

export const ESTIMATES = [15, 30, 60, 120, 240];

export function fmtMin(min: number) {
  const m = Math.round(min / 5) * 5;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export const estimateMin = (t: CuTask) => (t.estimate ? t.estimate / 60_000 : undefined);

/** 0 for Monday … 6 for Sunday. */
export const weekday = (day: string) => (new Date(`${day}T12:00:00`).getDay() + 6) % 7;

export const mondayOf = (day: string) => shiftDate(day, -weekday(day));

/** The days to plan: the rest of this week, or next week from Saturday on. */
export function planDays() {
  const t = today();
  const start = weekday(t) >= 5 ? shiftDate(mondayOf(t), 7) : t;
  const days: string[] = [];
  for (let d = start; d <= shiftDate(mondayOf(start), 6); d = shiftDate(d, 1)) days.push(d);
  return days;
}

export const dayName = (day: string, style: "long" | "short" = "long") =>
  new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: style, day: "numeric" });

export interface Triage {
  important: boolean;
  urgent: boolean;
}

/** Eisenhower quadrants, in the order to handle them. */
export const QUADRANTS = [
  { id: "do", label: "À faire en premier", hint: "urgent et important", match: (x: Triage) => x.important && x.urgent },
  { id: "plan", label: "À planifier", hint: "important, pas urgent", match: (x: Triage) => x.important && !x.urgent },
  { id: "batch", label: "À regrouper", hint: "urgent, pas important", match: (x: Triage) => !x.important && x.urgent },
  { id: "drop", label: "À lâcher ou plus tard", hint: "ni l'un ni l'autre", match: (x: Triage) => !x.important && !x.urgent },
] as const;

/** ClickUp priority for a quadrant, so the triage stays in ClickUp. */
export const priorityOf = (x: Triage): Priority =>
  x.important ? (x.urgent ? "urgent" : "high") : x.urgent ? "normal" : "low";

/** First guess from ClickUp: priority, and a due date within 2 days. */
export function guessTriage(t: CuTask): Triage {
  const soon = !!t.due && dayOf(t.due) <= shiftDate(today(), 2);
  return {
    important: t.priority === "urgent" || t.priority === "high",
    urgent: t.priority === "urgent" || soon,
  };
}

export interface WorkWindow {
  start: string;
  end: string;
}

export const DEFAULT_WINDOW: WorkWindow = { start: "09:00", end: "18:00" };

/** A day's work window and its local bounds, as ISO times for the server (which runs in UTC). */
export const dayWindow = (day: string, w: WorkWindow) => ({
  from: new Date(`${day}T${w.start}:00`).toISOString(),
  to: new Date(`${day}T${w.end}:00`).toISOString(),
  dayStart: new Date(`${day}T00:00:00`).toISOString(),
  dayEnd: new Date(`${shiftDate(day, 1)}T00:00:00`).toISOString(),
});
