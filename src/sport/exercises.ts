import { normalize } from "../nutrition/foods";

/**
 * Exercise library from Free Exercise DB (github.com/yuhonas/free-exercise-db),
 * public domain (Unlicense). Names translated to French; images stay on GitHub.
 */
export interface Exercise {
  id: string;
  fr: string;
  en: string;
  /** strength, powerlifting, olympic weightlifting, strongman, plyometrics, cardio, stretching */
  c: string;
  e: string;
  m: string[];
  m2?: string[];
  l: "beginner" | "intermediate" | "expert";
}

const IMAGES = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

/** Picture 0 is the start position, picture 1 the end position. */
export const exerciseImage = (id: string, n: 0 | 1 = 0) => `${IMAGES}/${id}/${n}.jpg`;

export const MUSCLES: Record<string, string> = {
  chest: "Pectoraux",
  lats: "Grand dorsal",
  "middle back": "Milieu du dos",
  "lower back": "Lombaires",
  traps: "Trapèzes",
  shoulders: "Épaules",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Avant-bras",
  quadriceps: "Quadriceps",
  hamstrings: "Ischio-jambiers",
  glutes: "Fessiers",
  adductors: "Adducteurs",
  abductors: "Abducteurs",
  calves: "Mollets",
  abdominals: "Abdos",
  neck: "Cou",
};

export const EQUIPMENT: Record<string, string> = {
  barbell: "Barre",
  dumbbell: "Haltères",
  "body only": "Poids du corps",
  cable: "Poulie",
  machine: "Machine",
  kettlebells: "Kettlebell",
  bands: "Élastique",
  "medicine ball": "Médecine-ball",
  "exercise ball": "Ballon",
  "foam roll": "Rouleau",
  "e-z curl bar": "Barre EZ",
  other: "Autre",
};

export const LEVELS: Record<Exercise["l"], string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  expert: "Expert",
};

/** Filters shown as chips: a body part, or a kind of training. */
export const GROUPS: { id: string; label: string; match: (x: Exercise) => boolean }[] = [
  { id: "chest", label: "Pectoraux", match: (x) => x.m.includes("chest") },
  { id: "back", label: "Dos", match: (x) => x.m.some((m) => ["lats", "middle back", "lower back", "traps"].includes(m)) },
  { id: "shoulders", label: "Épaules", match: (x) => x.m.includes("shoulders") },
  { id: "biceps", label: "Biceps", match: (x) => x.m.includes("biceps") },
  { id: "triceps", label: "Triceps", match: (x) => x.m.includes("triceps") },
  { id: "legs", label: "Jambes", match: (x) => x.m.some((m) => ["quadriceps", "hamstrings", "adductors", "abductors"].includes(m)) },
  { id: "glutes", label: "Fessiers", match: (x) => x.m.includes("glutes") },
  { id: "calves", label: "Mollets", match: (x) => x.m.includes("calves") },
  { id: "abs", label: "Abdos", match: (x) => x.m.includes("abdominals") },
  { id: "forearms", label: "Avant-bras", match: (x) => x.m.includes("forearms") },
  { id: "cardio", label: "Cardio et explosivité", match: (x) => x.c === "cardio" || x.c === "plyometrics" },
  { id: "stretching", label: "Étirements", match: (x) => x.c === "stretching" },
];

const STRENGTH = ["strength", "powerlifting", "olympic weightlifting", "strongman"];

let cache: Promise<Exercise[]> | null = null;

/** The library is loaded only when the user opens it. */
export function loadExercises() {
  cache ??= import("./exercises.json").then((m) => m.default as Exercise[]);
  return cache;
}

/**
 * Searches French and English names. With a body part, stretches are left out
 * unless asked for, so the list stays on training exercises.
 */
export function filterExercises(all: Exercise[], query: string, group: string | null) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const g = GROUPS.find((x) => x.id === group);
  return all.filter((x) => {
    if (g && !g.match(x)) return false;
    if (g && !["cardio", "stretching"].includes(g.id) && !STRENGTH.includes(x.c)) return false;
    if (!words.length) return true;
    const text = normalize(`${x.fr} ${x.en} ${x.m.map((m) => MUSCLES[m] ?? m).join(" ")} ${EQUIPMENT[x.e] ?? ""}`);
    return words.every((w) => text.includes(w));
  });
}

export const musclesLabel = (x: Exercise) => x.m.map((m) => MUSCLES[m] ?? m).join(", ");
