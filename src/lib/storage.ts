// Local persistence: every value lives in localStorage under "tdaf:<key>",
// and src/lib/sync.ts copies it to the server so every device sees the same data.
const PREFIX = "tdaf:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let onSave: ((key: string) => void) | undefined;
/** Called after each local change that was really written (sync marks it to send). */
export const setSaveListener = (fn: (key: string) => void) => (onSave = fn);

export function save<T>(key: string, value: T) {
  try {
    const raw = JSON.stringify(value);
    if (localStorage.getItem(`${PREFIX}${key}`) === raw) return;
    localStorage.setItem(`${PREFIX}${key}`, raw);
    onSave?.(key);
  } catch {
    // storage full or blocked: the app keeps working in memory
  }
}

/** Keys currently stored, without the prefix. */
export function storedKeys() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
  }
  return keys;
}

export const CHANGED_EVENT = "tdaf:changed";

/** Writes a value that came from elsewhere (another device) and tells the screens to reload it. */
export function writeFromOutside(key: string, value: unknown) {
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: key }));
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
