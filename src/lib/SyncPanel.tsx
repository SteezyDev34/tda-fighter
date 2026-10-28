import { useState } from "react";
import { connect, syncNow, useSyncStatus } from "./sync";

/** Bottom of the side menu: links this device to the online copy of the data. */
export function SyncPanel() {
  const s = useSyncStatus();
  const [code, setCode] = useState("");

  if (s.state === "code") {
    return (
      <form
        className="sync-panel stack tight"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void connect(code.trim());
        }}
      >
        <strong className="small">☁️ Retrouver mes données partout</strong>
        <span className="small muted">Entre le code d'accès de l'app (TDAF_ACCESS_CODE) : il sert aussi pour ClickUp.</span>
        {s.wrong && <span className="error small">Ce code n'est pas le bon.</span>}
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code d'accès" placeholder="Code d'accès" />
        <button className="primary">Relier cet appareil</button>
      </form>
    );
  }

  const line =
    s.state === "syncing"
      ? "Synchronisation…"
      : s.state === "ok"
        ? `Synchronisé à ${new Date(s.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
        : s.state === "offline"
          ? "Hors ligne : tes changements partiront au retour du réseau."
          : s.state === "setup"
            ? `Stockage en ligne pas encore configuré. ${s.message}`
            : s.state === "error"
              ? s.message
              : "";
  return (
    <div className="sync-panel small muted">
      <span>☁️ {line}</span>{" "}
      {s.state !== "syncing" && (
        <button className="link" onClick={() => void syncNow()}>
          Synchroniser
        </button>
      )}
    </div>
  );
}
