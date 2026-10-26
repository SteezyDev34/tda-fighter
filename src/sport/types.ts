export type SessionKind = "muscu" | "cardio" | "activite";

export const SESSION_KINDS: { id: SessionKind; label: string; short: string }[] = [
  { id: "muscu", label: "Musculation", short: "Muscu" },
  { id: "cardio", label: "Cardio", short: "Cardio" },
  { id: "activite", label: "Autre activité", short: "Sport" },
];

export const kindLabel = (kind: SessionKind) => SESSION_KINDS.find((k) => k.id === kind)?.label ?? kind;

export const CARDIO_ACTIVITIES = ["Course", "Vélo", "Natation", "Marche", "Rameur", "Elliptique", "Corde à sauter", "HIIT"];

export type Intensity = "facile" | "moyen" | "dur";

export const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: "facile", label: "Facile" },
  { id: "moyen", label: "Moyen" },
  { id: "dur", label: "Dur" },
];

export interface WorkoutSet {
  reps: number;
  /** Load in kg, 0 for bodyweight. */
  kg: number;
  /** Rest after the set, in seconds. */
  rest: number;
}

export interface SessionExercise {
  id: string;
  /** Id in the exercise library; missing for an exercise the user typed. */
  exId?: string;
  name: string;
  sets: WorkoutSet[];
}

export interface SportSession {
  id: string;
  date: string;
  /** "HH:MM" */
  time?: string;
  kind: SessionKind;
  /** Activity name: "Séance pecs", "Course", "Foot"… */
  name: string;
  /** Minutes. */
  duration?: number;
  /** Kilometres, for cardio. */
  distance?: number;
  intensity?: Intensity;
  /** Calories burned, as shown by the watch. Without it, the app estimates them. */
  kcal?: number;
  notes?: string;
  exercises: SessionExercise[];
  createdAt: string;
}

/** "3 × 10 à 40 kg", or one line per set when they differ. */
export function setsSummary(sets: WorkoutSet[]) {
  if (!sets.length) return "";
  const same = sets.every((s) => s.reps === sets[0].reps && s.kg === sets[0].kg);
  const one = (s: WorkoutSet) => `${s.reps}${s.kg ? ` à ${String(s.kg).replace(".", ",")} kg` : ""}`;
  return same ? `${sets.length} × ${one(sets[0])}` : sets.map(one).join(", ");
}

/** "1 min 30" from seconds. */
export function restLabel(seconds: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min${s ? ` ${String(s).padStart(2, "0")}` : ""}` : `${s} s`;
}

/** Library exercises already done, the most recent first. */
export function recentExerciseIds(sessions: SportSession[]) {
  const ids: string[] = [];
  const sorted = [...sessions].sort((a, b) =>
    (b.date + (b.time ?? "") + b.createdAt).localeCompare(a.date + (a.time ?? "") + a.createdAt),
  );
  for (const s of sorted) for (const e of s.exercises) if (e.exId && !ids.includes(e.exId)) ids.push(e.exId);
  return ids;
}
