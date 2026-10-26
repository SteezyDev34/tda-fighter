import { shiftDate, today } from "./storage";

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Monday of the week that contains the date. */
function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return shiftDate(date, -((day + 6) % 7));
}

interface Props {
  date: string;
  /** Short text under each day that has something (kcal eaten, sessions done…). */
  marks: Map<string, string>;
  onChange: (date: string) => void;
  /** Lets the user pick days after today (to plan ahead). */
  allowFuture?: boolean;
}

/** Week strip to browse day by day: each day shows its mark, or a dot when it has nothing. */
export function Agenda({ date, marks, onChange, allowFuture = false }: Props) {
  const now = today();
  const monday = weekStart(date);
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));

  return (
    <div className="card stack tight">
      <div className="row between">
        <button className="link" onClick={() => onChange(shiftDate(date, -7))} aria-label="Semaine précédente">
          ‹ Semaine
        </button>
        <strong className="agenda-title">{date === now ? "Aujourd'hui" : dayLabel(date)}</strong>
        <button
          className="link"
          onClick={() => onChange(!allowFuture && shiftDate(date, 7) > now ? now : shiftDate(date, 7))}
          disabled={!allowFuture && weekStart(now) === monday}
          aria-label="Semaine suivante"
        >
          Semaine ›
        </button>
      </div>
      <div className="agenda-week">
        {week.map((d) => {
          const mark = marks.get(d);
          const future = d > now;
          return (
            <button
              key={d}
              className="agenda-day"
              aria-pressed={d === date}
              aria-label={dayLabel(d)}
              disabled={future && !allowFuture}
              onClick={() => onChange(d)}
            >
              <span className="small muted">
                {new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "narrow" })}
              </span>
              <strong>{Number(d.slice(8))}</strong>
              <span className="small muted">{mark ?? (future ? "" : "·")}</span>
            </button>
          );
        })}
      </div>
      <div className="row between">
        <input
          type="date"
          value={date}
          max={allowFuture ? undefined : now}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Choisir une date"
        />
        {date !== now && <button onClick={() => onChange(now)}>Aujourd'hui</button>}
      </div>
    </div>
  );
}
