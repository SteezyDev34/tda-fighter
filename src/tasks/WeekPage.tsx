import { useEffect, useState } from "react";
import { shiftDate, today } from "../lib/storage";
import { usePersisted } from "../nutrition/useNutrition";
import { CaptureBox, DomainFilter, Gate, SyncLine } from "./parts";
import type { CuTask } from "./types";
import { dayOf, dueLabel, msOf, useTasksState } from "./useTasks";
import {
  BUFFER,
  dayName,
  DEFAULT_HOURS,
  DEFAULT_MIN,
  ESTIMATES,
  estimateMin,
  FILL,
  fmtMin,
  guessTriage,
  planDays,
  priorityOf,
  QUADRANTS,
  weekday,
  type Triage,
} from "./week";

interface Plan {
  summary: string;
  days: { date: string; taskIds: string[]; tip: string }[];
  later: { taskId: string; reason: string }[];
  advice: string[];
}

interface WeekState {
  /** First day planned: a new week starts the ritual over. */
  start: string;
  step: number;
  /** Tasks kept for the week, with their triage. */
  picked: Record<string, Triage>;
  plan?: Plan;
  applied?: boolean;
  /** What each project (ClickUp list) should reach this week. */
  goals?: Record<string, string>;
}

const STEPS = ["Vider", "Projets", "Prioriser", "Estimer", "Temps dispo", "Plan"];

const load = (tasks: CuTask[]) => tasks.reduce((sum, t) => sum + (estimateMin(t) ?? DEFAULT_MIN), 0) * BUFFER;

function Meter({ used, capacity }: { used: number; capacity: number }) {
  const over = used > capacity;
  return (
    <div className="stack tight">
      <div className="bar">
        <div className={over ? "bar-fill over" : "bar-fill"} style={{ width: `${Math.min(1, capacity ? used / capacity : 1) * 100}%` }} />
      </div>
      <span className={over ? "small late" : "small muted"}>
        {fmtMin(used)} prévues sur {fmtMin(capacity)} possibles{over ? " : trop chargé" : ""}
      </span>
    </div>
  );
}

export function WeekPage() {
  const t = useTasksState();
  const days = planDays();
  const [hours, setHours] = usePersisted<number[]>("week-hours", DEFAULT_HOURS);
  const [stored, setWeek] = usePersisted<WeekState | null>("week-plan", null);
  const week: WeekState = stored && stored.start === days[0] ? stored : { start: days[0], step: 0, picked: {} };
  const set = (patch: Partial<WeekState>) => setWeek({ ...week, ...patch });
  const [showAll, setShowAll] = useState(false);
  const [projectIdx, setProjectIdx] = useState(0);
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => t.ensureFresh(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = t.tasks.filter((x) => !x.closed && !x.parent && t.inFilter(x));
  const byId = (id: string) => t.tasks.find((x) => x.id === id);
  const picked = open.filter((x) => week.picked[x.id]);
  const last = days[days.length - 1];
  // Suggested for the week: dated before its end, or high priority.
  const relevant = (x: CuTask) =>
    (x.due && dayOf(x.due) <= shiftDate(last, 7)) || x.priority === "urgent" || x.priority === "high" || !!week.picked[x.id];
  const candidates = open.filter(relevant);
  const others = open.filter((x) => !relevant(x));
  // Projects are ClickUp lists, the most pressing and busiest first.
  const projects = [...new Set(open.map((x) => x.listId))]
    .map((id) => {
      const tasks = open.filter((x) => x.listId === id).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
      const x = tasks[0];
      const space = t.spaces.find((s) => s.id === x.spaceId)?.name ?? "";
      return {
        id,
        // A list just called "List" takes its folder's name.
        name: x.folderName && /^list[e]?$/i.test(x.listName) ? x.folderName : /^list[e]?$/i.test(x.listName) ? space : x.listName,
        path: [space, x.folderName, x.listName].filter(Boolean).join(" › "),
        spaceId: x.spaceId,
        tasks,
        pressing: tasks.filter(relevant).length,
      };
    })
    .sort((a, b) => b.pressing - a.pressing || b.tasks.length - a.tasks.length);
  const project = projects[Math.min(projectIdx, projects.length - 1)];
  const isLast = !!project && projects.indexOf(project) === projects.length - 1;
  const capacityOf = (d: string) => (hours[weekday(d)] ?? 0) * 60 * FILL;
  const totalCapacity = days.reduce((s, d) => s + capacityOf(d), 0);

  const togglePick = (x: CuTask) => {
    const next = { ...week.picked };
    if (next[x.id]) delete next[x.id];
    else next[x.id] = guessTriage(x);
    set({ picked: next });
  };
  const setTriage = (x: CuTask, patch: Partial<Triage>) => set({ picked: { ...week.picked, [x.id]: { ...week.picked[x.id], ...patch } } });

  /** The triage is saved as ClickUp priorities when leaving the step. */
  const saveTriage = async () => {
    for (const x of picked) {
      const p = priorityOf(week.picked[x.id]);
      if (p !== (x.priority ?? "normal")) await t.update(x, { priority: p });
    }
  };

  const goTo = async (step: number) => {
    if (week.step === 2 && step > 2) await saveTriage();
    set({ step });
  };

  const buildPlan = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/week-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          today: today(),
          days: days.map((d) => ({ date: d, label: dayName(d), hours: hours[weekday(d)] ?? 0 })),
          goals: projects
            .filter((p) => week.goals?.[p.id]?.trim())
            .map((p) => ({ project: p.name, goal: week.goals![p.id] })),
          tasks: picked.map((x) => ({
            id: x.id,
            name: x.name,
            list: t.pathOf(x),
            domain: t.domainOf(x.spaceId),
            ...week.picked[x.id],
            estimate: estimateMin(x),
            due: x.due ? dayOf(x.due) : undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      set({ plan: (await res.json()) as Plan, applied: false });
    } catch (e) {
      setError(`Le plan n'a pas pu être construit. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  };

  /** Each planned task gets its day as due date in ClickUp. */
  const apply = async () => {
    if (!week.plan) return;
    setBusy(true);
    for (const d of week.plan.days) {
      for (const id of d.taskIds) {
        const x = byId(id);
        if (x && (!x.due || dayOf(x.due) !== d.date)) await t.update(x, { due: msOf(d.date) });
      }
    }
    setBusy(false);
    set({ applied: true });
  };

  const stepper = (
    <ol className="stepper" aria-label="Étapes">
      {STEPS.map((s, i) => (
        <li key={s}>
          <button aria-current={week.step === i ? "step" : undefined} className={i < week.step ? "past" : undefined} onClick={() => goTo(i)}>
            <span className="step-n">{i + 1}</span>
            <span className="step-label">{s}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  const nav = (next: string, disabled = false) => (
    <div className="row">
      {week.step > 0 && <button onClick={() => goTo(week.step - 1)}>Retour</button>}
      <button className="primary grow" disabled={disabled} onClick={() => goTo(week.step + 1)}>{next}</button>
    </div>
  );

  return (
    <section className="stack">
      <h1>Ma semaine</h1>
      <Gate>
        <p className="small muted">
          Du {dayName(days[0])} au {dayName(last)}. 20 minutes pour organiser la semaine, et tu n'as plus qu'à suivre.
        </p>
        {stepper}

        {week.step === 0 && (
          <>
            <div className="card stack tight">
              <h2>1. Vider ta tête</h2>
              <p className="small">
                Note tout ce qui traîne dans ta tête, pro et perso, même les petites choses. Tant que c'est dans ta tête, ça prend de la place.
              </p>
            </div>
            <CaptureBox />
            {nav("C'est vidé, on passe aux projets")}
          </>
        )}

        {week.step === 1 && (
          <>
            <div className="card stack tight">
              <h2>2. Projet par projet</h2>
              <p className="small">
                Un projet à la fois : fixe ce qu'il doit atteindre cette semaine, coche les tâches qui y mènent et ajoute celles qui manquent.
                Un projet peut aussi attendre.
              </p>
            </div>
            <DomainFilter />
            {project ? (
              <div className="card stack">
                <div className="row between">
                  <span className="label">
                    Projet {projects.indexOf(project) + 1} / {projects.length}
                  </span>
                  <span className="pill">{t.domainOf(project.spaceId) === "pro" ? "Pro" : "Perso"}</span>
                </div>
                <h2>{project.name}</h2>
                <p className="small muted">{project.path}</p>
                <label className="stack tight">
                  <span className="label">Objectif de la semaine</span>
                  <input
                    value={week.goals?.[project.id] ?? ""}
                    onChange={(e) => set({ goals: { ...week.goals, [project.id]: e.target.value } })}
                    placeholder="Ex. : envoyer le devis, finir la maquette"
                  />
                </label>
                <span className="label">Tâches qui font avancer ce projet</span>
                {project.tasks.map((x) => (
                  <label key={x.id} className="check row">
                    <input type="checkbox" checked={!!week.picked[x.id]} onChange={() => togglePick(x)} />
                    <span className="stack tight">
                      <strong>{x.name}</strong>
                      {x.due && <span className="small muted">{dueLabel(x.due)}</span>}
                    </span>
                  </label>
                ))}
                <form
                  className="row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newTask.trim()) return;
                    const task = await t.create(project.id, newTask.trim());
                    if (task) {
                      setNewTask("");
                      set({ picked: { ...week.picked, [task.id]: guessTriage(task) } });
                    }
                  }}
                >
                  <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Tâche qui manque à ce projet" aria-label="Nouvelle tâche du projet" />
                  <button className="primary" disabled={!newTask.trim()} aria-label="Ajouter au projet">+</button>
                </form>
                <div className="row wrap">
                  <button
                    onClick={() => {
                      const next = { ...week.picked };
                      for (const x of project.tasks) delete next[x.id];
                      set({ picked: next });
                      if (isLast) goTo(2);
                      else setProjectIdx(projects.indexOf(project) + 1);
                    }}
                  >
                    Ce projet attend
                  </button>
                  <button className="primary grow" onClick={() => (isLast ? goTo(2) : setProjectIdx(projects.indexOf(project) + 1))}>
                    {isLast ? "Tous les projets sont vus ›" : "Projet suivant ›"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="small muted">Aucun projet avec des tâches ouvertes.</p>
            )}
            <div className="chips" aria-label="Tous les projets">
              {projects.map((p) => {
                const n = p.tasks.filter((x) => week.picked[x.id]).length;
                return (
                  <button key={p.id} className="chip" aria-pressed={p === project} onClick={() => setProjectIdx(projects.indexOf(p))}>
                    {p.name}
                    {n ? ` · ${n}` : ""}
                  </button>
                );
              })}
            </div>
            {nav(`Prioriser les ${picked.length} tâches choisies`, !picked.length)}
          </>
        )}

        {week.step === 2 && (
          <>
            <div className="card stack tight">
              <h2>3. Prioriser</h2>
              <p className="small">
                Vérifie ce qui doit avancer cette semaine, puis dis si c'est <strong>important</strong> (ça compte pour tes objectifs) et{" "}
                <strong>urgent</strong> (il y a une échéance proche). Le tri est enregistré dans ClickUp comme priorité.
              </p>
            </div>
            <DomainFilter />
            <div className="card stack tight">
              {[...candidates, ...(showAll ? others : [])].map((x) => {
                const tri = week.picked[x.id];
                return (
                  <div key={x.id} className="triage-row">
                    <label className="check row">
                      <input type="checkbox" checked={!!tri} onChange={() => togglePick(x)} />
                      <span className="stack tight">
                        <strong>{x.name}</strong>
                        <span className="small muted">
                          {t.pathOf(x)}
                          {x.due ? ` · ${dueLabel(x.due)}` : ""}
                        </span>
                      </span>
                    </label>
                    {tri && (
                      <div className="row wrap">
                        <button className="chip" aria-pressed={tri.important} onClick={() => setTriage(x, { important: !tri.important })}>Important</button>
                        <button className="chip" aria-pressed={tri.urgent} onClick={() => setTriage(x, { urgent: !tri.urgent })}>Urgent</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!candidates.length && !showAll && <p className="small muted">Rien d'urgent ni de daté. Regarde les autres tâches.</p>}
              {!showAll && others.length > 0 && (
                <button className="link start" onClick={() => setShowAll(true)}>Voir les {others.length} autres tâches</button>
              )}
            </div>
            {picked.length > 0 && (
              <div className="quadrants">
                {QUADRANTS.map((q) => {
                  const n = picked.filter((x) => q.match(week.picked[x.id])).length;
                  return (
                    <div key={q.id} className={`quadrant ${q.id}`}>
                      <strong>{n}</strong>
                      <span className="small">{q.label}</span>
                      <span className="small muted">{q.hint}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {nav(`Estimer ces ${picked.length} tâches`, !picked.length)}
          </>
        )}

        {week.step === 3 && (
          <>
            <div className="card stack tight">
              <h2>4. Estimer le temps</h2>
              <p className="small">
                Combien de temps pour chaque tâche, si tout va bien ? L'app ajoute ensuite une marge de 50 % : avec le TDAH, on sous-estime
                presque toujours. L'estimation est enregistrée dans ClickUp.
              </p>
            </div>
            <div className="card stack tight">
              {picked.map((x) => (
                <div key={x.id} className="triage-row">
                  <strong>{x.name}</strong>
                  <div className="row wrap">
                    {ESTIMATES.map((m) => (
                      <button key={m} className="chip" aria-pressed={estimateMin(x) === m} onClick={() => t.update(x, { estimate: m * 60_000 })}>
                        {fmtMin(m)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="small">
              Total : <strong>{fmtMin(load(picked) / BUFFER)}</strong>, soit <strong>{fmtMin(load(picked))}</strong> avec la marge.
              {picked.some((x) => !estimateMin(x)) && " Les tâches sans estimation comptent 30 min."}
            </p>
            {nav("Voir mon temps dispo")}
          </>
        )}

        {week.step === 4 && (
          <>
            <div className="card stack tight">
              <h2>5. Ton temps disponible</h2>
              <p className="small">
                Combien d'heures pour tes tâches chaque jour, en dehors du sport, des repas, des rendez-vous et du repos ? Seuls 70 % sont
                planifiés : le reste absorbe les imprévus.
              </p>
            </div>
            <div className="card stack tight">
              {days.map((d) => {
                const h = hours[weekday(d)] ?? 0;
                const setH = (v: number) => setHours(hours.map((x, i) => (i === weekday(d) ? Math.max(0, Math.min(12, v)) : x)));
                return (
                  <div key={d} className="row between">
                    <span className="day-name">{dayName(d)}</span>
                    <span className="row">
                      <button className="chip" aria-label={`Moins d'heures le ${dayName(d)}`} onClick={() => setH(h - 0.5)}>−</button>
                      <span className="hours">{String(h).replace(".", ",")} h</span>
                      <button className="chip" aria-label={`Plus d'heures le ${dayName(d)}`} onClick={() => setH(h + 0.5)}>+</button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="card stack tight">
              <span className="label">Ce qui tient dans ta semaine</span>
              <Meter used={load(picked)} capacity={totalCapacity} />
              <p className="small">
                {load(picked) > totalCapacity
                  ? "Tu as plus de tâches que de temps. C'est normal : l'IA va garder l'essentiel et mettre le reste de côté."
                  : "Ça tient, avec de la marge. Bien joué."}
              </p>
            </div>
            {nav("Construire mon plan")}
          </>
        )}

        {week.step === 5 && (
          <>
            {!week.plan ? (
              <div className="card stack">
                <h2>6. Ton plan de la semaine</h2>
                <p className="small">
                  L'IA répartit tes {picked.length} tâches sur tes jours : priorités d'abord, échéances respectées, tâches dures le matin et en
                  début de semaine, jamais plus que ton temps dispo.
                </p>
                <button className="primary" onClick={buildPlan} disabled={busy || !picked.length}>
                  {busy ? "Le coach organise ta semaine…" : "Construire mon plan avec l'IA"}
                </button>
              </div>
            ) : (
              <>
                <div className="card stack tight">
                  <h2>Ton plan</h2>
                  <p>{week.plan.summary}</p>
                </div>
                {week.plan.days.map((d) => {
                  const ts = d.taskIds.map(byId).filter((x): x is CuTask => !!x);
                  return (
                    <div key={d.date} className="card stack tight">
                      <div className="row between">
                        <h2 className="day-name">{dayName(d.date)}</h2>
                        <span className="pill">{ts.length} tâche{ts.length > 1 ? "s" : ""}</span>
                      </div>
                      {ts.length ? (
                        <ol className="session-exercises">
                          {ts.map((x) => (
                            <li key={x.id}>
                              {x.name} <span className="small muted">· {fmtMin(estimateMin(x) ?? DEFAULT_MIN)}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="small muted">Jour libre.</p>
                      )}
                      {ts.length > 0 && <Meter used={load(ts)} capacity={capacityOf(d.date)} />}
                      <p className="small">💡 {d.tip}</p>
                    </div>
                  );
                })}
                {week.plan.later.length > 0 && (
                  <div className="card stack tight">
                    <h2>Pas cette semaine</h2>
                    <ul className="session-exercises">
                      {week.plan.later.map((l) => (
                        <li key={l.taskId}>
                          <strong>{byId(l.taskId)?.name}</strong> <span className="small muted">· {l.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="card stack tight">
                  <h2>Conseils du coach</h2>
                  <ul className="session-exercises">
                    {week.plan.advice.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
                {week.applied ? (
                  <p className="cheer" role="status">✓ Plan appliqué : chaque tâche a son jour dans ClickUp. Tu le retrouves dans « Aujourd'hui ».</p>
                ) : (
                  <button className="primary" onClick={apply} disabled={busy}>
                    {busy ? "Mise à jour de ClickUp…" : "Appliquer : mettre ces dates dans ClickUp"}
                  </button>
                )}
                <button onClick={buildPlan} disabled={busy}>Refaire le plan</button>
              </>
            )}
            {error && <p className="error">{error}</p>}
            <button onClick={() => goTo(4)}>Retour</button>
          </>
        )}
        <SyncLine />
      </Gate>
    </section>
  );
}
