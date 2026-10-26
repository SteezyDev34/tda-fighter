const PLANNED = [
  "« Une seule chose maintenant » : la tâche à faire tout de suite, et rien d'autre",
  "Capture rapide d'une idée ou d'une tâche",
  "Découpage d'une grosse tâche en micro-étapes",
  "Top 3 des priorités du jour",
  "Minuteur focus avec un bouton « Je bloque »",
];

export function TasksPage() {
  return (
    <section className="stack">
      <h1>Tâches</h1>
      <div className="card stack tight">
        <span className="label">Bientôt ici</span>
        <ul className="session-exercises">
          {PLANNED.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
