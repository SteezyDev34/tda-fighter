import { useEffect, useState } from "react";
import { DomainFilter, Gate, SyncLine, TaskRow } from "./parts";
import { priorityRank, type CuList, type CuSpace, type Domain } from "./types";
import { colorHex, GCAL_COLORS } from "./colors";
import { useTasksState } from "./useTasks";

function ListView({ space, list, onBack }: { space: CuSpace; list: CuList; onBack: () => void }) {
  const t = useTasksState();
  const [name, setName] = useState("");
  const tasks = t.tasks
    .filter((x) => x.listId === list.id && !x.parent)
    .sort((a, b) => Number(a.closed) - Number(b.closed) || priorityRank(a.priority) - priorityRank(b.priority) || (a.due ?? Infinity) - (b.due ?? Infinity));
  return (
    <section className="stack">
      <button className="link start" onClick={onBack}>‹ Projets</button>
      <h1>{list.name}</h1>
      <p className="small muted">{space.name}{list.folder ? ` › ${list.folder}` : ""}</p>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim() && (await t.create(list.id, name.trim()))) setName("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajouter une tâche ici" aria-label="Nouvelle tâche dans cette liste" />
        <button className="primary" disabled={!name.trim()} aria-label="Ajouter">+</button>
      </form>
      <div className="card stack tight">
        {tasks.length ? tasks.map((x) => <TaskRow key={x.id} task={x} showList={false} />) : <p className="small muted">Aucune tâche ouverte.</p>}
      </div>
    </section>
  );
}

function Settings() {
  const t = useTasksState();
  const lists = (d: Domain) =>
    t.spaces
      .filter((s) => t.domainOf(s.id) === d)
      .flatMap((s) => s.lists.map((l) => ({ id: l.id, label: `${s.name} › ${l.folder ? `${l.folder} › ` : ""}${l.name}` })));
  return (
    <div className="card stack">
      <h2>Réglages</h2>
      <span className="label">Pro ou perso ?</span>
      {t.spaces.map((s) => (
        <div key={s.id} className="row between">
          <span>{s.name}</span>
          <span className="row">
            {(["pro", "perso"] as const).map((d) => (
              <button
                key={d}
                className="chip"
                aria-pressed={t.domainOf(s.id) === d}
                onClick={() =>
                  t.setPersoSpaces(d === "perso" ? [...new Set([...t.perso, s.id])] : t.perso.filter((id) => id !== s.id))
                }
              >
                {d === "pro" ? "Pro" : "Perso"}
              </button>
            ))}
          </span>
        </div>
      ))}
      {(["perso", "pro"] as const).map((d) => (
        <label key={d} className="stack tight">
          <span className="label">Les captures {d === "pro" ? "pro" : "perso"} vont dans</span>
          <select
            value={t.captureLists[d] ?? ""}
            onChange={(e) => t.setCaptureLists({ ...t.captureLists, [d]: e.target.value || undefined })}
          >
            <option value="">Première liste trouvée</option>
            {lists(d).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      ))}
      <button className="link start" onClick={() => t.saveCode("")}>Oublier le code d'accès sur ce téléphone</button>
    </div>
  );
}

export function ProjectsPage() {
  const t = useTasksState();
  const [open, setOpen] = useState<{ space: CuSpace; list: CuList } | null>(null);
  useEffect(() => t.ensureFresh(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (open) return <ListView {...open} onBack={() => setOpen(null)} />;

  const count = (listId: string) => t.tasks.filter((x) => x.listId === listId && !x.closed && !x.parent).length;
  const domains = (["pro", "perso"] as const).filter((d) => t.domainFilter === "all" || t.domainFilter === d);

  return (
    <section className="stack">
      <h1>Projets</h1>
      <Gate>
        <DomainFilter />
        {domains.map((d) => (
          <div key={d} className="stack tight">
            <span className="label">{d === "pro" ? "Pro" : "Perso"}</span>
            {t.spaces
              .filter((s) => t.domainOf(s.id) === d)
              .map((s) => (
                <div key={s.id} className="card stack tight">
                  <h2>{s.name}</h2>
                  {s.lists.map((l) => (
                    <div key={l.id} className="list-line">
                      <button
                        className="swatch"
                        style={{ background: colorHex(t.colorOf(l.id)) }}
                        aria-label={`Couleur dans l'agenda : ${GCAL_COLORS.find((c) => c.id === t.colorOf(l.id))?.name}. Changer`}
                        title="Couleur dans Google Agenda (toucher pour changer)"
                        onClick={() => t.nextColor(l.id)}
                      />
                      <button className="list-row" onClick={() => setOpen({ space: s, list: l })}>
                        <span>
                          {l.folder && <span className="muted">{l.folder} › </span>}
                          {l.name}
                        </span>
                        <span className="pill">{count(l.id)}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        ))}
        <Settings />
        <SyncLine />
      </Gate>
    </section>
  );
}
