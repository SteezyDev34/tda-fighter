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

export const today = () => new Date().toISOString().slice(0, 10);
