import { useState } from "react";
import { today } from "../lib/storage";
import { usePersisted } from "../nutrition/useNutrition";
import type { CuList, Domain, Priority } from "./types";
import { dueLabel, msOf, useTasksState } from "./useTasks";

/** Where a captured task goes. */
type Mode = "ai" | "existing" | "new-project" | "new-list";

const MODES: { id: Mode; label: string }[] = [
  { id: "ai", label: "✨ L'IA range" },
  { id: "existing", label: "📁 Projet existant" },
  { id: "new-project", label: "➕ Nouveau projet" },
  { id: "new-list", label: "➕ Nouvelle liste" },
];

const HINTS: Record<Mode, string> = {
  ai: "L'IA choisit le projet et repère la date (« demain », « vendredi »…).",
  existing: "La tâche va dans la liste choisie.",
  "new-project": "Crée le projet dans ClickUp (un dossier avec une liste « Tâches ») et y range la tâche.",
  "new-list": "Crée la liste dans ClickUp et y range la tâche.",
};

/** "Empty your head": one line, saved straight into ClickUp. */
export function CaptureBox() {
  const t = useTasksState();
  const [text, setText] = useState("");
  const [mode, setMode] = usePersisted<Mode>("capture-mode", "ai");
  const [lastList, setLastList] = usePersisted<string>("capture-last-list", "");
  const [spaceId, setSpaceId] = useState("");
  /** "space:<id>" or "folder:<spaceId>:<folderId>" */
  const [parent, setParent] = useState("");
  const [newName, setNewName] = useState("");
  const [forToday, setForToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ text: string; url?: string } | null>(null);

  const allLists = t.spaces.flatMap((s) =>
    s.lists.map((l) => ({ ...l, spaceId: s.id, path: [s.name, l.folder, /^list[e]?$/i.test(l.name) ? "" : l.name].filter(Boolean).join(" › ") })),
  );
  const byDomain = (d: Domain) => allLists.filter((l) => t.domainOf(l.spaceId) === d);
  const filter = t.domainFilter;
  const fallbackDomain: Domain = filter === "all" ? "perso" : filter;
  const fallbackId =
    t.captureLists[fallbackDomain] ?? allLists.find((l) => t.domainOf(l.spaceId) === fallbackDomain)?.id ?? allLists[0]?.id;
  const chosenList = allLists.some((l) => l.id === lastList) ? lastList : "";
  const chosenSpace = spaceId || t.spaces[0]?.id || "";
  const chosenParent = parent || (t.spaces[0] ? `space:${t.spaces[0].id}` : "");

  /** Asks the AI where the task goes; falls back to the capture list. */
  const sort = async (line: string) => {
    const lists = allLists
      .filter((l) => filter === "all" || t.domainOf(l.spaceId) === filter)
      .map((l) => ({
        id: l.id,
        path: l.path,
        domain: t.domainOf(l.spaceId),
        examples: t.tasks.filter((x) => x.listId === l.id && !x.parent).slice(0, 4).map((x) => x.name),
      }));
    try {
      const res = await fetch("/api/sort-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line, today: today(), lists }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { listId: string; name: string; due: string | null; priority: Priority | null };
    } catch {
      return fallbackId ? { listId: fallbackId, name: line, due: null, priority: null } : null;
    }
  };

  /** The list chosen or created for this mode. */
  const target = async (): Promise<CuList | string | undefined | null> => {
    if (mode === "existing") return chosenList || null;
    if (mode === "new-project") return t.createProject(chosenSpace, newName.trim());
    const [kind, sId, folderId] = chosenParent.split(":");
    return t.createList(sId, newName.trim(), kind === "folder" ? folderId : undefined);
  };

  const ready = !!text.trim() && !busy && (mode === "ai" || (mode === "existing" ? !!chosenList : !!newName.trim()));

  const submit = async () => {
    const line = text.trim();
    if (!ready) return;
    setBusy(true);
    let listId: string | undefined;
    let name = line;
    let due: string | null = forToday ? today() : null;
    let priority: Priority | null = null;
    if (mode === "ai") {
      const sorted = await sort(line);
      if (sorted) {
        listId = sorted.listId;
        name = sorted.name;
        due = forToday ? today() : sorted.due;
        priority = sorted.priority;
      }
    } else {
      const list = await target();
      listId = typeof list === "string" ? list : list?.id;
    }
    if (listId) {
      const task = await t.create(listId, name, { ...(due && { due: msOf(due) }), ...(priority && { priority }) });
      if (task) {
        setText("");
        // A new project or list becomes the place for the next captures.
        if (mode === "new-project" || mode === "new-list") {
          setNewName("");
          setMode("existing");
        }
        if (mode !== "ai") setLastList(listId);
        setSaved({ text: `« ${task.name} » rangé dans ${t.pathOf(task)}${due ? ` · ${dueLabel(msOf(due))}` : ""}`, url: task.url });
      }
    }
    setBusy(false);
  };

  return (
    <form
      className="card stack tight"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="label">Vider ma tête</span>
      <div className="row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. : envoyer le devis Dorado vendredi"
          aria-label="Nouvelle tâche"
          disabled={busy}
        />
        <button className="primary" disabled={!ready} aria-label="Ajouter">{busy ? "…" : "+"}</button>
      </div>

      <div className="chips" role="group" aria-label="Où ranger la tâche">
        {MODES.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "existing" && (
        <select value={chosenList} onChange={(e) => setLastList(e.target.value)} aria-label="Projet et liste">
          <option value="">Choisis un projet…</option>
          {(["pro", "perso"] as const).map((d) => (
            <optgroup key={d} label={d === "pro" ? "Pro" : "Perso"}>
              {byDomain(d).map((l) => (
                <option key={l.id} value={l.id}>{l.path}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {mode === "new-project" && (
        <div className="stack tight">
          <select value={chosenSpace} onChange={(e) => setSpaceId(e.target.value)} aria-label="Espace du nouveau projet">
            {t.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({t.domainOf(s.id) === "pro" ? "pro" : "perso"})
              </option>
            ))}
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du nouveau projet" aria-label="Nom du nouveau projet" />
        </div>
      )}

      {mode === "new-list" && (
        <div className="stack tight">
          <select value={chosenParent} onChange={(e) => setParent(e.target.value)} aria-label="Où créer la liste">
            {t.spaces.map((s) => (
              <optgroup key={s.id} label={s.name}>
                <option value={`space:${s.id}`}>{s.name} (directement dans l'espace)</option>
                {(s.folders ?? []).map((f) => (
                  <option key={f.id} value={`folder:${s.id}:${f.id}`}>
                    {s.name} › {f.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la nouvelle liste" aria-label="Nom de la nouvelle liste" />
        </div>
      )}

      <div className="row wrap">
        <button type="button" className="chip" aria-pressed={forToday} onClick={() => setForToday(!forToday)}>
          Pour aujourd'hui
        </button>
      </div>
      <p className="small muted">
        {busy ? (
          mode === "ai" ? "L'IA range ta tâche…" : "Envoi vers ClickUp…"
        ) : saved ? (
          <>
            {saved.text}
            {saved.url && (
              <>
                {" · "}
                <a href={saved.url} target="_blank" rel="noreferrer">Voir dans ClickUp</a>
              </>
            )}
          </>
        ) : (
          HINTS[mode]
        )}
      </p>
    </form>
  );
}
