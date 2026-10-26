import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SportSession } from "../src/sport/types";
import { buildSystem, client, MODEL } from "./_lib/claude.js";

const ReportSchema = z.object({
  summary: z.string(),
  wins: z.array(z.string()),
  improve: z.array(z.string()),
  tomorrow: z.string(),
});

const describeSession = (s: SportSession & { kcal?: number; kcalEstimated?: boolean }) => {
  const facts = [
    s.time,
    s.duration && `${s.duration} min`,
    s.distance && `${s.distance} km`,
    s.intensity && `intensité ${s.intensity}`,
    s.kcal && `${s.kcal} kcal ${s.kcalEstimated ? "estimées" : "mesurées par la montre"}`,
  ].filter(Boolean);
  const exercises = s.exercises
    .map((e) => `${e.name} : ${e.sets.map((x) => `${x.reps}×${x.kg} kg`).join(", ")}`)
    .join(" ; ");
  return `- ${s.kind} « ${s.name} » (${facts.join(", ")})${exercises ? ` : ${exercises}` : ""}${s.notes ? ` — notes : ${s.notes}` : ""}`;
};

/** End-of-day report: what was eaten and the training done, read together. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { date, profile, journal, sessions } = req.body as {
    date: string;
    profile: Parameters<typeof buildSystem>[0];
    /** Lines of that day (and a few days before, for the trend). */
    journal: Parameters<typeof buildSystem>[1];
    sessions: (SportSession & { kcal?: number; kcalEstimated?: boolean })[];
  };

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium", format: zodOutputFormat(ReportSchema) },
      system: await buildSystem(profile, journal),
      messages: [
        {
          role: "user",
          content: `Fais le bilan de ma journée du ${date}, en croisant ce que j'ai mangé (journal, lignes de cette date) et le sport fait.

Sport ce jour-là :
${sessions.length ? sessions.map(describeSession).join("\n") : "- aucune séance (jour de repos)"}

Regarde : calories et protéines par rapport à mes objectifs et à l'effort du jour, repas sautés ou notés, placement des repas
autour de la séance, récupération. Si le journal du jour est vide ou incomplet, dis-le simplement sans en tirer de conclusion.
Les calories dépensées estimées sont approximatives (±20 %).

- "summary" : 2 phrases maximum sur la journée.
- "wins" : 1 à 3 choses réussies, concrètes.
- "improve" : 0 à 3 points à ajuster, formulés comme des actions, sans culpabiliser.
- "tomorrow" : une seule action simple pour demain.`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucun bilan généré.");
    }
    res.json(response.parsed_output);
  } catch (err) {
    console.error(err);
    res.status(500).send("Le coach est indisponible.");
  }
}
