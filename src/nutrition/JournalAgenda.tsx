import { shiftDate, today } from "../lib/storage";
import type { JournalEntry } from "./types";

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Monday of the week that contains the date. */
function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return shiftDate(date, -((day + 6) % 7));
}

interface Props {
  date: string;
  journal: JournalEntry[];
  onChange: (date: string) => void;
}

/** Week strip to browse the journal day by day: a dot marks the days with something logged. */
export function JournalAgenda({ date, journal, onChange }: Props) {
  const now = today();
  const monday = weekStart(date);
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const kcalByDay = new Map<string, number>();
  for (const e of journal) kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + e.nutrients.kcal);

  return (
    <div className="card stack tight">
      <div className="row between">
        <button className="link" onClick={() => onChange(shiftDate(date, -7))} aria-label="Semaine précédente">
          ‹ Semaine
        </button>
        <strong className="agenda-title">{date === now ? "Aujourd'hui" : dayLabel(date)}</strong>
        <button
          className="link"
          onClick={() => onChange(shiftDate(date, 7) > now ? now : shiftDate(date, 7))}
          disabled={weekStart(now) === monday}
          aria-label="Semaine suivante"
        >
          Semaine ›
        </button>
      </div>
      <div className="agenda-week">
        {week.map((d) => {
          const kcal = kcalByDay.get(d);
          const future = d > now;
          return (
            <button
              key={d}
              className="agenda-day"
              aria-pressed={d === date}
              aria-label={dayLabel(d)}
              disabled={future}
              onClick={() => onChange(d)}
            >
              <span className="small muted">
                {new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "narrow" })}
              </span>
              <strong>{Number(d.slice(8))}</strong>
              <span className="small muted">{kcal ? Math.round(kcal) : future ? "" : "·"}</span>
            </button>
          );
        })}
      </div>
      <div className="row between">
        <input
          id="journal-date"
          type="date"
          value={date}
          max={now}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Choisir une date"
        />
        {date !== now && <button onClick={() => onChange(now)}>Aujourd'hui</button>}
      </div>
    </div>
  );
}
