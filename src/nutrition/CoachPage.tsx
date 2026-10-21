import { Fragment, useState } from "react";
import { recentJournal, usePersisted, type NutritionState } from "./useNutrition";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

/** Conversations kept on the device, newest first. */
const MAX_CONVERSATIONS = 50;
/** Only the end of a long conversation is sent to the coach. */
const MAX_SENT_MESSAGES = 20;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
  const [conversations, setConversations] = usePersisted<Conversation[]>("coach-conversations", []);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const current = conversations.find((c) => c.id === currentId);
  const messages = current?.messages ?? [];

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const id = current?.id ?? crypto.randomUUID();
    const title = current?.title ?? text.trim().slice(0, 60);
    const history: ChatMessage[] = [...messages, { role: "user", content: text.trim() }];
    // Saves the conversation at the top of the history on every streamed chunk.
    const setMessages = (msgs: ChatMessage[]) =>
      setConversations((all) =>
        [{ id, title, updatedAt: new Date().toISOString(), messages: msgs }, ...all.filter((c) => c.id !== id)].slice(
          0,
          MAX_CONVERSATIONS,
        ),
      );
    setCurrentId(id);
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    let sent = history.slice(-MAX_SENT_MESSAGES);
    if (sent[0]?.role === "assistant") sent = sent.slice(1);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sent, profile, journal: recentJournal(journal) }),
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
      <div className="row between">
        <h1>Coach nutrition</h1>
        {current && (
          <button onClick={() => setCurrentId(null)} disabled={busy}>Nouvelle conversation</button>
        )}
      </div>
      {!current && (
        <div className="stack">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
      {!current && conversations.length > 0 && (
        <div className="stack tight">
          <span className="label">Conversations précédentes</span>
          {conversations.map((c) => (
            <div key={c.id} className="row">
              <button className="result" onClick={() => setCurrentId(c.id)}>
                <span>{c.title}</span>
                <span className="small muted">
                  {when(c.updatedAt)} · {c.messages.length} message{c.messages.length > 1 ? "s" : ""}
                </span>
              </button>
              <button
                className="link"
                aria-label={`Supprimer la conversation ${c.title}`}
                onClick={() => setConversations((all) => all.filter((x) => x.id !== c.id))}
              >
                Supprimer
              </button>
            </div>
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
