import { useState } from "react";
import { CoachPage } from "./nutrition/CoachPage";
import { JournalPage } from "./nutrition/JournalPage";
import { PlannerPage } from "./nutrition/PlannerPage";
import { ProfilePage } from "./nutrition/ProfilePage";
import { useNutrition } from "./nutrition/useNutrition";
import { SportPage } from "./sport/SportPage";

const TABS = [
  { id: "journal", label: "Journal", Page: JournalPage },
  { id: "planner", label: "Repas", Page: PlannerPage },
  { id: "sport", label: "Sport", Page: SportPage },
  { id: "coach", label: "Coach", Page: CoachPage },
  { id: "profile", label: "Critères", Page: ProfilePage },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const nutrition = useNutrition();
  const [tab, setTab] = useState<TabId>("journal");
  const { Page } = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <main className="app">
        <Page {...nutrition} />
      </main>
      <nav className="tabs" aria-label="Navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={t.id === tab ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
