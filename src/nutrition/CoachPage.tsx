import { Fragment, useState } from "react";
import { recentJournal, type NutritionState } from "./useNutrition";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Shows the coach's Markdown bold and headings as bold text instead of raw "**" and "#". */
function CoachText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const parts = (heading ? heading[1] : line).split(/\*\*(.+?)\*\*/g);
        return (
          <Fragment key={i}>
            {i > 0 && "\n"}
            {parts.map((p, j) => (j % 2 || heading ? <strong key={j}>{p}</strong> : p))}
          </Fragment>
        );
      })}
    </>
  );
}

const SUGGESTIONS = [
  "J'ai une fringale, qu'est-ce que je peux manger ?",
  "Qu'est-ce qui me manque aujourd'hui ?",
  "Une idée de dîner rapide avec ce que j'ai déjà mangé ?",
];

export function CoachPage({ journal, profile }: NutritionState) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, profile, journal: recentJournal(journal) }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch {
      setMessages([
        ...history,
        { role: "assistant", content: "Je n'ai pas pu répondre. Vérifie ta connexion et renvoie ta question." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack">
      <h1>Coach nutrition</h1>
      {messages.length === 0 && (
        <div className="stack">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
      <div className="stack">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content ? <CoachText text={m.content} /> : "…"}
          </div>
        ))}
      </div>
      <form
        className="row chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          id="chat"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question"
          autoComplete="off"
        />
        <button className="primary" disabled={busy}>Envoyer</button>
      </form>
    </section>
  );
}
