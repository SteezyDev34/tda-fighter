import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { client, MODEL } from "./_lib/claude.js";

const SortSchema = z.object({
  listId: z.string(),
  name: z.string(),
  due: z.string().nullable(),
  priority: z.enum(["urgent", "high", "normal", "low"]).nullable(),
});

interface ListInfo {
  id: string;
  /** "SPACE › Folder › List" */
  path: string;
  domain: "pro" | "perso";
  /** A few open tasks, to understand what the list is about. */
  examples: string[];
}

/** Reads a captured line and files it: which ClickUp list, clean name, due date, priority. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { text, today, lists } = req.body as { text: string; today: string; lists: ListInfo[] };
  if (!text?.trim() || !lists?.length) return res.status(400).send("Texte et listes obligatoires.");

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(SortSchema) },
      system: `Tu ranges une tâche notée en vitesse par une personne TDAH dans le bon projet ClickUp.
- "listId" : l'id de la liste qui correspond le mieux, d'après son chemin et ses tâches d'exemple. Si rien ne correspond, une liste générale (souvent « List ») de l'espace pro ou perso le plus probable.
- "name" : la tâche reformulée courte, qui commence par un verbe d'action, sans la date ni le mot urgent, en français, avec les noms propres gardés.
- "due" : la date "YYYY-MM-DD" si le texte en donne une (demain, vendredi, le 12, avant la fin du mois…), sinon null. Aujourd'hui : ${today}.
- "priority" : "urgent" si le texte dit urgent ou ASAP, "high" si c'est important, sinon null.`,
      messages: [
        {
          role: "user",
          content: `Listes :
${lists.map((l) => `- [${l.id}] ${l.path} (${l.domain})${l.examples.length ? ` · ex. : ${l.examples.join(" ; ")}` : ""}`).join("\n")}

Tâche notée : ${text.trim()}`,
        },
      ],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) return res.status(502).send("Tâche non rangée.");
    const listId = lists.some((l) => l.id === out.listId) ? out.listId : lists[0].id;
    const due = out.due && /^\d{4}-\d{2}-\d{2}$/.test(out.due) ? out.due : null;
    res.json({ ...out, listId, due, name: out.name.trim() || text.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le rangement automatique est indisponible.");
  }
}
