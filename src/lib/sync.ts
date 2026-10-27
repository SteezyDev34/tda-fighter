import { useSyncExternalStore } from "react";
import { load, save, setSaveListener, storedKeys, writeFromOutside } from "./storage";

/** Kept on each device only: the access code, ClickUp's cache, the screen last opened. */
const LOCAL_ONLY = new Set(["clickup-code", "clickup-spaces", "clickup-tasks", "clickup-synced", "section", "section-tabs"]);
const CODE_KEY = "clickup-code";

// Sync bookkeeping, outside the "tdaf:" keys so it is never synced itself.
const META = "tdaf-sync";
type Meta = {
  /** Server cursor of the last sync; absent before this device's first sync. */
  since?: number;
  /** When each value was last edited (on this device or the one it came from). */
  times: Record<string, number>;
  /** Keys changed here and not yet on the server. */
  pending: string[];
};

function readMeta(): Meta {
  try {
    return { times: {}, pending: [], ...JSON.parse(localStorage.getItem(META) ?? "{}") };
  } catch {
    return { times: {}, pending: [] };
  }
}
function writeMeta(m: Meta) {
  try {
    localStorage.setItem(META, JSON.stringify(m));
  } catch {
    // storage blocked: sync starts over next time
  }
}

export type SyncStatus =
  | { state: "code"; wrong?: boolean }
  | { state: "syncing" | "offline" }
  | { state: "setup" | "error"; message: string }
  | { state: "ok"; at: number };

let status: SyncStatus = { state: load(CODE_KEY, "") ? "syncing" : "code" };
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l());
};

export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );

/**
 * Data saved on a device before sync existed, met with the server's on the first sync:
 * lists keep the items of both (by id), objects keep the keys of both, the server's winning.
 */
function mergeFirstTime(local: unknown, remote: unknown): unknown {
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (Array.isArray(local) && Array.isArray(remote)) {
    const idOf = (x: unknown) => (isObj(x) && "id" in x ? String(x.id) : JSON.stringify(x));
    const seen = new Set(remote.map(idOf));
    return [...remote, ...local.filter((x) => !seen.has(idOf(x)))];
  }
  if (isObj(local) && isObj(remote)) return { ...local, ...remote };
  return remote;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function post(code: string, since: number, changes: Record<string, { v: unknown; t: number }>) {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tdaf-code": code },
    body: JSON.stringify({ since, changes }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return (await res.json()) as { cursor: number; values: Record<string, { v: unknown; t: number }> };
}

let running: Promise<void> | null = null;
let again = false;

/** Sends this device's changes and takes the others'. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

async function run() {
  const code = load(CODE_KEY, "");
  if (!code) return setStatus({ state: "code" });
  if (!navigator.onLine) return setStatus({ state: "offline" });
  setStatus({ state: "syncing" });
  try {
    let meta = readMeta();
    const first = meta.since === undefined;
    const local = new Set(storedKeys().filter((k) => !LOCAL_ONLY.has(k)));

    // First sync of this device: what is already here is merged with the server, nothing is lost.
    if (first) {
      const { cursor, values } = await post(code, 0, {});
      meta = readMeta();
      for (const [key, remote] of Object.entries(values)) {
        if (LOCAL_ONLY.has(key)) continue;
        const merged = local.has(key) ? mergeFirstTime(load(key, null), remote.v) : remote.v;
        writeFromOutside(key, merged);
        if (JSON.stringify(merged) === JSON.stringify(remote.v)) {
          meta.times[key] = remote.t;
          local.delete(key);
        } else meta.times[key] = Date.now();
      }
      // What is left (only here, or merged with the server's) is sent just below.
      for (const key of local) meta.times[key] ??= Date.now();
      meta.pending = [...new Set([...meta.pending, ...local])];
      meta.since = cursor;
      writeMeta(meta);
    }

    const sent = meta.pending;
    const changes: Record<string, { v: unknown; t: number }> = {};
    for (const key of sent) changes[key] = { v: load(key, null), t: meta.times[key] ?? Date.now() };
    const { cursor, values } = await post(code, meta.since ?? 0, changes);

    // Re-read: the person may have changed something while the request was out.
    meta = readMeta();
    const changedMeanwhile = new Set(meta.pending.filter((k) => meta.times[k] !== changes[k]?.t));
    for (const [key, remote] of Object.entries(values)) {
      if (LOCAL_ONLY.has(key) || changedMeanwhile.has(key)) continue;
      writeFromOutside(key, remote.v);
      meta.times[key] = remote.t;
    }
    meta.pending = meta.pending.filter((k) => changedMeanwhile.has(k) || !sent.includes(k));
    meta.since = cursor;
    writeMeta(meta);
    setStatus({ state: "ok", at: Date.now() });
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 0;
    if (s === 401) setStatus({ state: "code", wrong: true });
    else if (s === 503) setStatus({ state: "setup", message: (e as Error).message });
    else if (!s) setStatus({ state: "offline" });
    else setStatus({ state: "error", message: (e as Error).message });
  }
}

/** Keeps this device's code (the same one ClickUp asks for) and syncs. */
export function connect(code: string) {
  save(CODE_KEY, code);
  writeFromOutside(CODE_KEY, code); // ClickUp's screens pick it up too
  return syncNow();
}

let timer: ReturnType<typeof setTimeout> | undefined;
setSaveListener((key) => {
  if (key === CODE_KEY) return void syncNow();
  if (LOCAL_ONLY.has(key)) return;
  const meta = readMeta();
  meta.times[key] = Date.now();
  if (!meta.pending.includes(key)) meta.pending.push(key);
  writeMeta(meta);
  // Sent a moment later, so a burst of edits goes in one request.
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 2_000);
});

/** Starts syncing: now, when the app comes back to the screen or online, and every minute while open. */
export function startSync() {
  void syncNow();
  const wake = () => document.visibilityState === "visible" && void syncNow();
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
  setInterval(wake, 60_000);
}
