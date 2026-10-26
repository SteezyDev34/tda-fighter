import { usePersisted } from "../nutrition/useNutrition";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { recentExerciseIds, type SportSession } from "./types";

export function ExercisesPage() {
  const [sessions] = usePersisted<SportSession[]>("sport-sessions", []);
  return (
    <section className="stack">
      <h1>Exercices</h1>
      <ExerciseLibrary recent={recentExerciseIds(sessions)} />
    </section>
  );
}
