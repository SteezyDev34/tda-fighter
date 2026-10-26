import { useState } from "react";
import { Agenda } from "../lib/Agenda";
import { shiftDate, today } from "../lib/storage";
import { DailyIntake } from "../nutrition/DailyIntake";
import { MEAL_SLOTS } from "../nutrition/types";
import { usePersisted, type NutritionState } from "../nutrition/useNutrition";
import { sessionKcal, weightFrom } from "../sport/calories";
import { kindLabel, type SportSession } from "../sport/types";

interface Report {
  summary: string;
  wins: string[];
  improve: string[];
  tomorrow: string;
  /** When the report was made: a report older than the last change can be redone. */
  at: string;
}

export function ReportPage({ profile, journal }: NutritionState) {
  const [sessions] = usePersisted<SportSession[]>("sport-sessions", []);
  const [reports, setReports] = usePersisted<Record<string, Report>>("daily-reports", {});
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const weight = weightFrom(profile.body);
  const eaten = journal.filter((e) => e.date === date);
  const ofDay = sessions
    .filter((s) => s.date === date)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
    .map((s) => ({ ...s, ...sessionKcal(s, weight) }));
  const burned = ofDay.reduce((sum, s) => sum + (s.kcal ?? 0), 0);
  const anyEstimate = ofDay.some((s) => s.kcal && !s.measured);
  const missing = MEAL_SLOTS.filter((m) => !eaten.some((e) => e.slot === m.id));
  const report = reports[date];

  // Days with something logged get a mark in the agenda.
  const marks = new Map<string, string>();
  for (const e of journal) marks.set(e.date, "✓");
  for (const s of sessions) marks.set(s.date, "✓");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          profile,
          // The day itself, and the 6 days before for the trend.
          journal: journal.filter((e) => e.date <= date && e.date > shiftDate(date, -7)),
          sessions: ofDay.map(({ measured, ...s }) => ({ ...s, kcalEstimated: !measured })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as Omit<Report, "at">;
      setReports((all) => ({ ...all, [date]: { ...r, at: new Date().toISOString() } }));
    } catch (e) {
      setError(`Le bilan n'a pas pu être fait. Réessaie dans un instant. (${(e as Error).message})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack">
      <h1>Bilan du jour</h1>
      <Agenda date={date} marks={marks} onChange={setDate} />

      <DailyIntake entries={eaten} targets={profile.targets} />

      <div className="card stack tight">
        <h2>Repas</h2>
        <p className="small">
          {eaten.length === 0
            ? "Rien de noté dans le journal ce jour-là."
            : missing.length === 0
              ? "Tous les repas sont notés."
              : `Pas noté : ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`}
        </p>
      </div>

      <div className="card stack tight">
        <div className="row between">
          <h2>Sport</h2>
          {burned > 0 && (
            <span className="pill">
              {anyEstimate ? "≈ " : ""}
              {burned} kcal dépensées
            </span>
          )}
        </div>
        {ofDay.length === 0 ? (
          <p className="small muted">Pas de séance : jour de repos.</p>
        ) : (
          <ul className="session-exercises">
            {ofDay.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span className="small muted">
                  {" "}
                  {kindLabel(s.kind)}
                  {s.duration ? ` · ${s.duration} min` : ""}
                  {s.kcal ? ` · ${s.measured ? "" : "≈ "}${s.kcal} kcal` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card stack">
        <h2>L'avis du coach</h2>
        {report ? (
          <>
            <p>{report.summary}</p>
            {report.wins.length > 0 && (
              <div className="stack tight">
                <span className="label">Réussi</span>
                <ul className="session-exercises">
                  {report.wins.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            {report.improve.length > 0 && (
              <div className="stack tight">
                <span className="label">À ajuster</span>
                <ul className="session-exercises">
                  {report.improve.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="stack tight">
              <span className="label">Pour demain</span>
              <p className="m0"><strong>{report.tomorrow}</strong></p>
            </div>
            <button onClick={generate} disabled={loading}>
              {loading ? "Le coach relit ta journée…" : "Refaire le bilan"}
            </button>
          </>
        ) : (
          <>
            <p className="small muted">
              Le coach lit ton journal et tes séances du jour, et te dit ce qui a marché et quoi ajuster demain.
            </p>
            <button className="primary" onClick={generate} disabled={loading || (eaten.length === 0 && ofDay.length === 0)}>
              {loading ? "Le coach relit ta journée…" : "Faire le bilan de la journée"}
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
