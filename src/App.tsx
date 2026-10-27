import { useEffect, useState } from "react";
import { SyncPanel } from "./lib/SyncPanel";
import { usePersisted } from "./nutrition/useNutrition";
import { CoachPage } from "./nutrition/CoachPage";
import { JournalPage } from "./nutrition/JournalPage";
import { PlannerPage } from "./nutrition/PlannerPage";
import { ProfilePage } from "./nutrition/ProfilePage";
import { useNutrition } from "./nutrition/useNutrition";
import { ReportPage } from "./report/ReportPage";
import { ExercisesPage } from "./sport/ExercisesPage";
import { SportPage } from "./sport/SportPage";
import { NowPage } from "./tasks/NowPage";
import { ProjectsPage } from "./tasks/ProjectsPage";
import { TodayPage } from "./tasks/TodayPage";
import { WeekPage } from "./tasks/WeekPage";
import { TasksContext, useTasks } from "./tasks/useTasks";

type Nutrition = ReturnType<typeof useNutrition>;
type Tab = { id: string; label: string; Page: (props: Nutrition) => React.ReactNode };

/** Each section has its own menu at the bottom of the screen. */
const SECTIONS: { id: string; label: string; icon: string; tabs: Tab[] }[] = [
  {
    id: "nutrition",
    label: "Nutrition",
    icon: "🥗",
    tabs: [
      { id: "journal", label: "Journal", Page: JournalPage },
      { id: "planner", label: "Repas", Page: PlannerPage },
      { id: "coach", label: "Coach", Page: CoachPage },
      { id: "profile", label: "Critères", Page: ProfilePage },
    ],
  },
  {
    id: "sport",
    label: "Sport",
    icon: "🏋️",
    tabs: [
      { id: "sessions", label: "Séances", Page: SportPage },
      { id: "exercises", label: "Exercices", Page: ExercisesPage },
    ],
  },
  {
    id: "report",
    label: "Bilan",
    icon: "📊",
    tabs: [{ id: "day", label: "Jour", Page: ReportPage }],
  },
  {
    id: "tasks",
    label: "Tâches",
    icon: "✅",
    tabs: [
      { id: "now", label: "Maintenant", Page: NowPage },
      { id: "today", label: "Aujourd'hui", Page: TodayPage },
      { id: "week", label: "Semaine", Page: WeekPage },
      { id: "projects", label: "Projets", Page: ProjectsPage },
    ],
  },
];

export default function App() {
  const nutrition = useNutrition();
  const tasks = useTasks();
  const [sectionId, setSectionId] = usePersisted("section", "nutrition");
  // The tab last opened in each section, so switching back lands where you were.
  const [tabs, setTabs] = usePersisted<Record<string, string>>("section-tabs", {});
  const [menuOpen, setMenuOpen] = useState(false);

  // A screen can open another tab (a task tapped in a list opens « Maintenant »).
  useEffect(() => {
    const go = (e: Event) => {
      const { section, tab } = (e as CustomEvent<{ section: string; tab: string }>).detail;
      setSectionId(section);
      setTabs((all) => ({ ...all, [section]: tab }));
    };
    window.addEventListener("tdaf:navigate", go);
    return () => window.removeEventListener("tdaf:navigate", go);
  }, [setSectionId, setTabs]);

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  const tab = section.tabs.find((t) => t.id === tabs[section.id]) ?? section.tabs[0];
  const { Page } = tab;

  return (
    <TasksContext.Provider value={tasks}>
      <div className="layout">
        <header className="topbar">
          <button className="menu-button" aria-label="Ouvrir le menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <span className="topbar-title">
            {section.icon} {section.label}
          </span>
        </header>

        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
        <aside className={menuOpen ? "sidebar open" : "sidebar"} aria-label="Sections">
          <strong className="sidebar-brand">TDA Fighter</strong>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              aria-current={s.id === section.id ? "page" : undefined}
              onClick={() => {
                setSectionId(s.id);
                setMenuOpen(false);
              }}
            >
              <span aria-hidden="true">{s.icon}</span> {s.label}
            </button>
          ))}
          <SyncPanel />
        </aside>

        <main className="app" key={`${section.id}/${tab.id}`}>
          <Page {...nutrition} />
        </main>

        {section.tabs.length > 1 && (
          <nav className="tabs" aria-label={`Menu ${section.label}`}>
            {section.tabs.map((t) => (
              <button
                key={t.id}
                aria-current={t.id === tab.id ? "page" : undefined}
                onClick={() => setTabs((all) => ({ ...all, [section.id]: t.id }))}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </TasksContext.Provider>
  );
}
