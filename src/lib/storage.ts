// Local persistence for the MVP. Will move to a synced backend later.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`tdaf:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(`tdaf:${key}`, JSON.stringify(value));
  } catch {
    // storage full or blocked: the app keeps working in memory
  }
}

/** "YYYY-MM-DD" in the user's own time zone (toISOString would give the UTC day). */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = () => isoDate(new Date());

/** Adds days to a "YYYY-MM-DD" date. */
export const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};
