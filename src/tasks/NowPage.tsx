import { useEffect, useState } from "react";
import { shiftDate, today } from "../lib/storage";
import { usePersisted } from "../nutrition/useNutrition";
import { Gate, SyncLine } from "./parts";
import { priorityRank, type CuTask } from "./types";
import { dayOf, dueLabel, msOf, navigate, streak, useTasksState } from "./useTasks";

interface Timer {
  taskId: string;
  start: number;
  minutes: number;
  logged?: boolean;
}

/** Overdue and today first, then by priority, then by due date. */
function byUrgency(a: CuTask, b: CuTask) {
  const t = today();
  const hot = (x: CuTask) => (x.due && dayOf(x.due) <= t ? 0 : 1);
  return hot(a) - hot(b) || priorityRank(a.priority) - priorityRank(b.priority) || (a.due ?? Infinity) - (b.due ?? Infinity);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function FocusTimer({ task, timer, setTimer }: { task: CuTask; timer: Timer | null; setTimer: (t: Timer | null) => void }) {
  const t = useTasksState();
  const [now, setNow] = useState(Date.now());
  const mine = timer?.taskId === task.id ? timer : null;
  const left = mine ? Math.min(mine.minutes * 60_000, mine.start + mine.minutes * 60_000 - now) : 0;

  useEffect(() => {
    if (!mine) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mine]);

  // At the end, the session is logged as time spent in ClickUp, once.
  useEffect(() => {
    if (mine && left <= 0 && !mine.logged) {
      setTimer({ ...mine, logged: true });
      t.logTime(task, mine.start, mine.minutes * 60_000);
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [mine, left, task, t, setTimer]);

  const start = (minutes: number) => {
    setNow(Date.now());
    setTimer({ taskId: task.id, start: Date.now(), minutes });
  };
  const stop = () => {
    if (mine && !mine.logged) {
      const spent = Date.now() - mine.start;
      if (spent >= 60_000) t.logTime(task, mine.start, spent);
    }
    setTimer(null);
  };

  if (mine && left > 0) {
    return (
      <div className="card stack focus">
        <span className="label">Focus en cours</span>
        <p className="timer" role="timer">{mmss(left)}</p>
        <p className="small muted">Une seule chose. Si une idée arrive, note-la dans « Vider ma tête » et reviens.</p>
        <button onClick={stop}>Arrêter</button>
      </div>
    );
  }
  if (mine) {
    return (
      <div className="card stack focus">
        <p className="timer-done">Bravo, {mine.minutes} min de focus 🎉</p>
        <p className="small muted">Le temps est noté dans ClickUp.</p>
        <div className="row wrap">
          <button onClick={() => start(5)}>Encore 5 min</button>
          <button onClick={() => setTimer(null)}>Pause</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card stack tight">
      <span className="label">Lancer un focus</span>
      <div className="row">
        {[5, 15, 25].map((m) => (
          <button key={m} className={m === 25 ? "primary grow" : "grow"} onClick={() => start(m)}>
            {m} min
          </button>
        ))}
      </div>
    </div>
  );
}

function Blocked({
  task,
  onSkip,
  onFiveMinutes,
  onClose,
}: {
  task: CuTask;
  onSkip: () => void;
  onFiveMinutes: () => void;
  onClose: () => void;
}) {
  const t = useTasksState();
  const [steps, setSteps] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = t.tasks.filter((x) => x.parent === task.id).map((x) => x.name);

  const split = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/task-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: task.name, description: task.description, list: t.pathOf(task), existing }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSteps(((await res.json()) as { steps: string[] }).steps);
    } catch (e) {
      setError(`Le découpage a échoué. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  };

  const addSteps = async () => {
    if (!steps) return;
    setBusy(true);
    for (const s of steps) await t.create(task.listId, s, { parent: task.id });
    setBusy(false);
    setSteps(null);
    onClose();
  };

  if (steps) {
    return (
      <div className="card stack">
        <span className="label">Micro-étapes proposées</span>
        <ol className="session-exercises">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <button className="primary" onClick={addSteps} disabled={busy}>
          {busy ? "Ajout dans ClickUp…" : "Ajouter comme sous-tâches dans ClickUp"}
        </button>
        <button className="link" onClick={() => setSteps(null)}>Annuler</button>
      </div>
    );
  }
  return (
    <div className="card stack tight">
      <span className="label">Ça bloque ? Choisis une sortie</span>
      <button onClick={split} disabled={busy}>{busy ? "Découpage…" : "✂️ Découper en micro-étapes"}</button>
      <button onClick={onFiveMinutes}>⏱️ Juste 5 minutes, pour démarrer</button>
      <button onClick={() => t.update(task, { due: msOf(shiftDate(today(), 1)) }).then(onSkip)}>📅 Reporter à demain</button>
      <button onClick={onSkip}>🔀 Passer à une autre tâche</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function NowPage() {
  const t = useTasksState();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [cheer, setCheer] = useState("");
  const [timer, setTimer] = usePersisted<Timer | null>("focus-timer", null);

  useEffect(() => t.ensureFresh(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = t.tasks.filter((x) => !x.closed && !x.parent && t.inFilter(x) && !skipped.includes(x.id));
  const chosen = open.find((x) => x.id === t.focusId);
  const fromTop3 = t.top3.map((id) => open.find((x) => x.id === id)).find(Boolean);
  const task = chosen ?? fromTop3 ?? [...open].sort(byUrgency)[0];
  const steps = task ? t.tasks.filter((x) => x.parent === task.id) : [];
  const nextStep = steps.find((s) => !s.closed);

  const next = () => {
    if (task) setSkipped((s) => [...s, task.id]);
    t.setFocusId(null);
    setBlocked(false);
  };

  const done = async () => {
    if (!task) return;
    const r = await t.complete(task);
    if (r) {
      const n = (t.doneDays[today()] ?? 0) + 1;
      setCheer(`✓ « ${task.name} » terminé. ${n} tâche${n > 1 ? "s" : ""} aujourd'hui, série de ${Math.max(1, streak(t.doneDays))} jour(s).`);
      t.setFocusId(null);
      setBlocked(false);
    }
  };

  return (
    <section className="stack">
      <h1>Maintenant</h1>
      <Gate>
        {cheer && <p className="cheer" role="status">{cheer}</p>}
        {!task ? (
          <div className="card stack tight">
            <h2>{t.loading ? "Chargement de tes tâches…" : "Rien d'urgent 🎉"}</h2>
            {!t.loading && (
              <p className="small muted">
                Aucune tâche ouverte ici. Ajoute-en une dans Aujourd'hui, ou repose-toi, c'est mérité.
              </p>
            )}
          </div>
        ) : (
          <>
            <article className="card stack now-card">
              <span className="label">Ta seule mission</span>
              <h2 className="now-title">{task.name}</h2>
              <p className="small muted">
                {t.pathOf(task)}
                {task.due ? ` · ${dueLabel(task.due)}` : ""}
                {" · "}
                {t.domainOf(task.spaceId) === "pro" ? "Pro" : "Perso"}
              </p>
              {nextStep && (
                <p className="next-step">
                  <span className="label">Prochaine étape</span>
                  <br />
                  {nextStep.name}
                </p>
              )}
              {steps.length > 0 && (
                <ul className="steps">
                  {steps.map((s) => (
                    <li key={s.id}>
                      <label className={s.closed ? "check done row" : "check row"}>
                        <input type="checkbox" checked={s.closed} onChange={() => t.complete(s, !s.closed)} />
                        <span>{s.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button className="primary big" onClick={done}>C'est fait ✓</button>
              <div className="row between">
                <button className="link" onClick={() => setBlocked(!blocked)}>{blocked ? "Fermer" : "Je bloque"}</button>
                <a className="small" href={task.url} target="_blank" rel="noreferrer">Ouvrir dans ClickUp</a>
              </div>
            </article>
            {blocked && (
              <Blocked
                task={task}
                onSkip={next}
                onClose={() => setBlocked(false)}
                onFiveMinutes={() => {
                  setTimer({ taskId: task.id, start: Date.now(), minutes: 5 });
                  setBlocked(false);
                }}
              />
            )}
            <FocusTimer task={task} timer={timer} setTimer={setTimer} />
            {open.length > 1 && (
              <button className="link start" onClick={() => navigate("tasks", "today")}>
                Voir les {open.length - 1} autres tâches
              </button>
            )}
          </>
        )}
        <SyncLine />
      </Gate>
    </section>
  );
}
