import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { client, MODEL } from "./_lib/claude.js";

const StepsSchema = z.object({ steps: z.array(z.string()) });

/** Breaks a task that blocks into micro-steps, the first one tiny. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { name, description, list, existing } = req.body as {
    name: string;
    description?: string;
    list?: string;
    /** Subtasks already there, not to repeat. */
    existing?: string[];
  };
  if (!name?.trim()) return res.status(400).send("Tâche manquante.");

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(StepsSchema) },
      system: `Tu aides une personne TDAH à démarrer une tâche qui la bloque. Réponds en français.
Découpe la tâche en 3 à 7 micro-étapes concrètes et physiques, chacune faisable en 2 à 10 minutes.
La première étape doit être ridiculement facile (ouvrir le fichier, poser la feuille sur le bureau…).
Chaque étape commence par un verbe d'action, 12 mots maximum, sans numérotation.`,
      messages: [
        {
          role: "user",
          content: `Tâche : ${name}${list ? `\nProjet : ${list}` : ""}${description ? `\nDescription : ${description}` : ""}${
            existing?.length ? `\nÉtapes déjà prévues (à ne pas répéter) : ${existing.join(" ; ")}` : ""
          }`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucune étape proposée.");
    }
    res.json({ steps: response.parsed_output.steps.slice(0, 7) });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le découpage est indisponible.");
  }
}
