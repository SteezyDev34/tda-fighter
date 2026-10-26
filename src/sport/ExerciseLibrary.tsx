import { useEffect, useState } from "react";
import {
  EQUIPMENT,
  exerciseImage,
  filterExercises,
  GROUPS,
  LEVELS,
  loadExercises,
  MUSCLES,
  musclesLabel,
  type Exercise,
} from "./exercises";

const PAGE = 40;

/** Thumbnail that disappears if the picture can't be loaded (offline, missing). */
function Thumb({ id, n = 0, big = false }: { id: string; n?: 0 | 1; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={big ? "ex-img big missing" : "ex-img missing"} aria-hidden="true" />;
  return (
    <img
      className={big ? "ex-img big" : "ex-img"}
      src={exerciseImage(id, n)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ExerciseDetail({ ex, onBack, onPick }: { ex: Exercise; onBack: () => void; onPick?: (ex: Exercise) => void }) {
  return (
    <div className="stack">
      <button className="link start" onClick={onBack}>‹ Retour à la liste</button>
      <h2>{ex.fr}</h2>
      <p className="small muted">{ex.en}</p>
      <div className="ex-pair">
        <figure>
          <Thumb id={ex.id} big />
          <figcaption className="small muted">Départ</figcaption>
        </figure>
        <figure>
          <Thumb id={ex.id} n={1} big />
          <figcaption className="small muted">Arrivée</figcaption>
        </figure>
      </div>
      <p>
        <strong>Muscles travaillés :</strong> {musclesLabel(ex)}
        {ex.m2?.length ? (
          <span className="muted"> (et {ex.m2.map((m) => MUSCLES[m] ?? m).join(", ").toLowerCase()})</span>
        ) : null}
      </p>
      <p>
        <strong>Matériel :</strong> {EQUIPMENT[ex.e] ?? ex.e} · <strong>Niveau :</strong> {LEVELS[ex.l]}
      </p>
      {onPick && (
        <button className="primary" onClick={() => onPick(ex)}>Ajouter à ma séance</button>
      )}
    </div>
  );
}

interface Props {
  /** Without it, the library is only for browsing. */
  onPick?: (ex: Exercise) => void;
  /** Adds an exercise the library doesn't have, under the typed name. */
  onPickCustom?: (name: string) => void;
}

export function ExerciseLibrary({ onPick, onPickCustom }: Props) {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Exercise | null>(null);

  useEffect(() => {
    loadExercises().then(setAll, () => setError(true));
  }, []);

  if (error) return <p className="error">La bibliothèque n'a pas pu être chargée. Vérifie ta connexion.</p>;
  if (!all) return <p className="muted">Chargement des exercices…</p>;
  if (open) return <ExerciseDetail ex={open} onBack={() => setOpen(null)} onPick={onPick} />;

  const results = filterExercises(all, query, group);

  return (
    <div className="stack">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        placeholder="Chercher : développé couché, squat, biceps…"
        aria-label="Chercher un exercice"
      />
      <div className="chips" role="group" aria-label="Filtrer par muscle">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="chip"
            aria-pressed={group === g.id}
            onClick={() => {
              setGroup(group === g.id ? null : g.id);
              setShown(PAGE);
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="small muted">{results.length} exercice{results.length > 1 ? "s" : ""}</p>
      <div className="stack tight">
        {results.slice(0, shown).map((ex) => (
          <button key={ex.id} className="ex-row" onClick={() => setOpen(ex)}>
            <Thumb id={ex.id} />
            <span className="stack tight">
              <strong>{ex.fr}</strong>
              <span className="small muted">
                {musclesLabel(ex)} · {EQUIPMENT[ex.e] ?? ex.e}
              </span>
            </span>
          </button>
        ))}
      </div>
      {results.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE)}>Voir plus d'exercices</button>
      )}
      {onPickCustom && query.trim() && (
        <button className="link start" onClick={() => onPickCustom(query.trim())}>
          Pas dans la liste ? Ajouter « {query.trim()} » à ma séance
        </button>
      )}
      <p className="small muted">
        Exercices et images :{" "}
        <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">Free Exercise DB</a>{" "}
        (domaine public).
      </p>
    </div>
  );
}
