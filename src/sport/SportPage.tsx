import { useState } from "react";
import { Agenda } from "../lib/Agenda";
import { today } from "../lib/storage";
import { usePersisted } from "../nutrition/useNutrition";
import { SessionEditor } from "./SessionEditor";
import {
  INTENSITIES,
  kindLabel,
  restLabel,
  SESSION_KINDS,
  setsSummary,
  type SessionKind,
  type SportSession,
} from "./types";

/** What a day shows in the agenda: the kinds of sessions done. */
function sessionMarks(sessions: SportSession[]) {
  const byDay = new Map<string, Set<string>>();
  for (const s of sessions) {
    const short = SESSION_KINDS.find((k) => k.id === s.kind)?.short ?? "";
    byDay.set(s.date, (byDay.get(s.date) ?? new Set()).add(short));
  }
  return new Map([...byDay].map(([d, kinds]) => [d, kinds.size > 1 ? `${kinds.size} ×` : [...kinds][0]]));
}

function SessionCard({ s, onEdit }: { s: SportSession; onEdit: () => void }) {
  const facts = [
    s.time && s.time.replace(/^0/, "").replace(":", " h ").replace(/ h 00$/, " h"),
    s.duration && `${s.duration} min`,
    s.distance && `${String(s.distance).replace(".", ",")} km`,
    s.intensity && INTENSITIES.find((i) => i.id === s.intensity)?.label,
  ].filter(Boolean);
  return (
    <article className="card stack tight">
      <div className="row between">
        <span className="label">{kindLabel(s.kind)}</span>
        <button className="link" onClick={onEdit}>Modifier</button>
      </div>
      <h2>{s.name}</h2>
      {facts.length > 0 && <p className="small muted">{facts.join(" · ")}</p>}
      {s.exercises.length > 0 && (
        <ul className="session-exercises">
          {s.exercises.map((e) => (
            <li key={e.id}>
              <strong>{e.name}</strong>
              <span className="small muted">
                {" "}
                {setsSummary(e.sets)}
                {e.sets[0]?.rest ? ` · repos ${restLabel(e.sets[0].rest)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {s.notes && <p className="small">{s.notes}</p>}
    </article>
  );
}

const newSession = (kind: SessionKind, date: string): SportSession => ({
  id: crypto.randomUUID(),
  date,
  kind,
  name: "",
  exercises: [],
  createdAt: new Date().toISOString(),
});

export function SportPage() {
  const [sessions, setSessions] = usePersisted<SportSession[]>("sport-sessions", []);
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<{ session: SportSession; isNew: boolean } | null>(null);

  if (editing) {
    return (
      <SessionEditor
        initial={editing.session}
        history={sessions}
        onCancel={() => setEditing(null)}
        onSave={(s) => {
          setSessions((all) => (editing.isNew ? [s, ...all] : all.map((x) => (x.id === s.id ? s : x))));
          setDate(s.date);
          setEditing(null);
        }}
        onDelete={
          editing.isNew
            ? undefined
            : () => {
                setSessions((all) => all.filter((x) => x.id !== editing.session.id));
                setEditing(null);
              }
        }
      />
    );
  }

  const ofDay = sessions
    .filter((s) => s.date === date)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  return (
    <section className="stack">
      <h1>Séances</h1>
      <Agenda date={date} marks={sessionMarks(sessions)} onChange={setDate} allowFuture />

      <div className="card stack">
        <span className="label">Ajouter une séance</span>
        <div className="row wrap">
          {SESSION_KINDS.map((k) => (
            <button key={k.id} onClick={() => setEditing({ session: newSession(k.id, date), isNew: true })}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {ofDay.length === 0 ? (
        <p className="muted">Aucune séance ce jour-là.</p>
      ) : (
        ofDay.map((s) => <SessionCard key={s.id} s={s} onEdit={() => setEditing({ session: s, isNew: false })} />)
      )}
    </section>
  );
}
