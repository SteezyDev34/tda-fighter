import { useEffect, useState, type InputHTMLAttributes } from "react";
import { estimateKcal } from "./calories";
import { ExerciseLibrary } from "./ExerciseLibrary";
import {
  CARDIO_ACTIVITIES,
  INTENSITIES,
  kindLabel,
  recentExerciseIds,
  setsSummary,
  type SessionExercise,
  type SportSession,
  type WorkoutSet,
} from "./types";

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const DEFAULT_SET: WorkoutSet = { reps: 10, kg: 0, rest: 90 };

/** Empty field means "not given". */
const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v.replace(",", "."))) || 0);

/** Number field that keeps what is being typed ("42," on the way to "42,5"). */
function NumField({
  value,
  onValue,
  ...rest
}: { value: number | undefined; onValue: (v: number | undefined) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value">) {
  const format = (v: number | undefined) => (v ? String(v).replace(".", ",") : "");
  const [text, setText] = useState(format(value));
  // Follows changes made elsewhere (a set removed above, a copied set).
  useEffect(() => {
    if ((num(text) ?? 0) !== (value ?? 0)) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValue(num(e.target.value));
      }}
    />
  );
}

/** The last time this exercise was done, to start from the same sets. */
function lastTime(history: SportSession[], ex: { exId?: string; name: string }, before: string) {
  const sessions = history
    .filter((s) => s.date <= before)
    .sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));
  for (const s of sessions) {
    const found = s.exercises.find((e) => (ex.exId ? e.exId === ex.exId : e.name === ex.name));
    if (found?.sets.length) return { date: s.date, sets: found.sets };
  }
  return null;
}

function SetsEditor({
  exercise,
  previous,
  onChange,
  onRemove,
}: {
  exercise: SessionExercise;
  previous: { date: string; sets: WorkoutSet[] } | null;
  onChange: (e: SessionExercise) => void;
  onRemove: () => void;
}) {
  const setSet = (i: number, patch: Partial<WorkoutSet>) =>
    onChange({ ...exercise, sets: exercise.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="card stack tight">
      <div className="row between">
        <strong>{exercise.name}</strong>
        <button className="link" onClick={onRemove}>Retirer</button>
      </div>
      {previous && (
        <p className="small muted">
          La dernière fois ({shortDate(previous.date)}) : {setsSummary(previous.sets)}
        </p>
      )}
      <div className="sets">
        <span className="small muted">Série</span>
        <span className="small muted">Répét.</span>
        <span className="small muted">Kg</span>
        <span className="small muted">Repos (s)</span>
        <span />
        {exercise.sets.map((s, i) => (
          <div key={i} className="set-row">
            <span className="set-n">{i + 1}</span>
            <NumField
              inputMode="numeric"
              value={s.reps}
              onValue={(v) => setSet(i, { reps: v ?? 0 })}
              aria-label={`Série ${i + 1} : répétitions`}
            />
            <NumField
              inputMode="decimal"
              value={s.kg}
              placeholder="0"
              onValue={(v) => setSet(i, { kg: v ?? 0 })}
              aria-label={`Série ${i + 1} : charge en kg`}
            />
            <NumField
              inputMode="numeric"
              value={s.rest}
              onValue={(v) => setSet(i, { rest: v ?? 0 })}
              aria-label={`Série ${i + 1} : repos en secondes`}
            />
            <button
              className="link"
              aria-label={`Supprimer la série ${i + 1}`}
              onClick={() => onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        className="link start"
        onClick={() => onChange({ ...exercise, sets: [...exercise.sets, exercise.sets.at(-1) ?? DEFAULT_SET] })}
      >
        + Ajouter une série
      </button>
    </div>
  );
}

interface Props {
  initial: SportSession;
  history: SportSession[];
  /** Body weight in kg, for the calories estimate. */
  weight?: number;
  onSave: (s: SportSession) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function SessionEditor({ initial, history, weight, onSave, onCancel, onDelete }: Props) {
  const [s, setS] = useState(initial);
  const [picking, setPicking] = useState(false);
  const others = history.filter((h) => h.id !== s.id);
  const set = (patch: Partial<SportSession>) => setS((x) => ({ ...x, ...patch }));
  const estimate = estimateKcal(s, weight);

  const addExercise = (ex: { exId?: string; name: string }) => {
    const previous = lastTime(others, ex, s.date);
    set({
      exercises: [
        ...s.exercises,
        { id: crypto.randomUUID(), ...ex, sets: previous ? previous.sets : [DEFAULT_SET, DEFAULT_SET, DEFAULT_SET] },
      ],
    });
    setPicking(false);
  };

  if (picking) {
    return (
      <section className="stack">
        <div className="row between">
          <h1>Ajouter un exercice</h1>
          <button className="link" onClick={() => setPicking(false)}>Annuler</button>
        </div>
        <ExerciseLibrary
          onPick={(ex) => addExercise({ exId: ex.id, name: ex.fr })}
          onPickCustom={(name) => addExercise({ name })}
          recent={recentExerciseIds(history)}
        />
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="row between">
        <h1>{kindLabel(s.kind)}</h1>
        <button className="link" onClick={onCancel}>Annuler</button>
      </div>

      <div className="card stack">
        <div className="row">
          <label className="grow">
            <span className="label">Date</span>
            <input type="date" value={s.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </label>
          <label className="grow">
            <span className="label">Heure</span>
            <input type="time" value={s.time ?? ""} onChange={(e) => set({ time: e.target.value || undefined })} />
          </label>
        </div>

        {s.kind === "cardio" ? (
          <>
            <span className="label">Activité</span>
            <div className="chips">
              {CARDIO_ACTIVITIES.map((a) => (
                <button key={a} type="button" className="chip" aria-pressed={s.name === a} onClick={() => set({ name: a })}>
                  {a}
                </button>
              ))}
            </div>
            <input value={s.name} onChange={(e) => set({ name: e.target.value })} aria-label="Nom de l'activité" placeholder="Ou écris l'activité" />
          </>
        ) : (
          <label>
            <span className="label">{s.kind === "muscu" ? "Nom de la séance" : "Activité"}</span>
            <input
              value={s.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={s.kind === "muscu" ? "Ex. Pecs / triceps" : "Ex. Foot, boxe, yoga, randonnée"}
            />
          </label>
        )}

        <div className="row">
          <label className="grow">
            <span className="label">Durée (min)</span>
            <NumField inputMode="numeric" value={s.duration} onValue={(v) => set({ duration: v })} />
          </label>
          {s.kind === "cardio" && (
            <label className="grow">
              <span className="label">Distance (km)</span>
              <NumField inputMode="decimal" value={s.distance} onValue={(v) => set({ distance: v })} />
            </label>
          )}
        </div>

        <label>
          <span className="label">Calories dépensées</span>
          <NumField
            inputMode="numeric"
            value={s.kcal}
            onValue={(v) => set({ kcal: v })}
            placeholder={estimate ? `≈ ${estimate} kcal estimées` : "Chiffre de ta montre"}
          />
        </label>
        <p className="small muted">
          {estimate
            ? "Laisse vide pour garder l'estimation, ou mets le chiffre de ta Fitbit."
            : weight
              ? "Indique la durée pour avoir une estimation, ou mets le chiffre de ta Fitbit."
              : "Ajoute ton poids dans Nutrition › Critères (« Moi ») pour avoir une estimation."}
        </p>

        <span className="label">Intensité</span>
        <div className="row">
          {INTENSITIES.map((i) => (
            <button
              key={i.id}
              type="button"
              className="chip"
              aria-pressed={s.intensity === i.id}
              onClick={() => set({ intensity: s.intensity === i.id ? undefined : i.id })}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {s.kind === "muscu" && (
        <>
          {s.exercises.map((ex, i) => (
            <SetsEditor
              key={ex.id}
              exercise={ex}
              previous={lastTime(others, ex, s.date)}
              onChange={(e) => set({ exercises: s.exercises.map((x, j) => (j === i ? e : x)) })}
              onRemove={() => set({ exercises: s.exercises.filter((_, j) => j !== i) })}
            />
          ))}
          <button onClick={() => setPicking(true)}>+ Ajouter un exercice</button>
        </>
      )}

      <label className="card stack tight">
        <span className="label">Notes</span>
        <textarea rows={3} value={s.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="Ressenti, douleurs, records…" />
      </label>

      <button className="primary" onClick={() => onSave({ ...s, name: s.name.trim() || kindLabel(s.kind) })}>
        Enregistrer la séance
      </button>
      {onDelete && (
        <button className="link" onClick={onDelete}>Supprimer cette séance</button>
      )}
    </section>
  );
}
