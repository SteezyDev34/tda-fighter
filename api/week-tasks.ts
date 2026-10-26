import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { client, MODEL } from "./_lib/claude.js";

const PlanSchema = z.object({
  summary: z.string(),
  days: z.array(z.object({ date: z.string(), taskIds: z.array(z.string()), tip: z.string() })),
  later: z.array(z.object({ taskId: z.string(), reason: z.string() })),
  advice: z.array(z.string()),
});

interface PlanTask {
  id: string;
  name: string;
  list: string;
  domain: "pro" | "perso";
  important: boolean;
  urgent: boolean;
  /** Minutes, without the buffer. */
  estimate?: number;
  /** "YYYY-MM-DD" */
  due?: string;
}

const SYSTEM = `Tu es le coach d'organisation de TDA Fighter, une app pour les personnes TDAH. Réponds en français, phrases courtes, sans culpabiliser.
Tu construis un plan de semaine réaliste avec les méthodes qui marchent pour le TDAH :
- Capacité réelle : le temps de chaque tâche est multiplié par 1,5 (cécité temporelle) et on ne remplit que 70 % des heures disponibles d'un jour, le reste sert d'imprévus.
- Matrice d'Eisenhower : urgent et important d'abord et tôt dans la semaine ; important non urgent planifié et protégé ; urgent non important regroupé en petits créneaux ; ni urgent ni important hors de la semaine (à abandonner ou plus tard).
- Échéances : une tâche datée est placée au plus tard le jour de son échéance, idéalement un jour avant.
- Règle 1-3-5 : au plus 1 grosse tâche (plus de 1 h 30), 3 moyennes et 5 petites par jour.
- Énergie : les tâches les plus dures en début de journée et en début de semaine ; un jour plus léger en fin de semaine.
- Une tâche sans estimation compte 30 minutes.
- Jour sans heure disponible : aucune tâche.
Tout ce qui ne tient pas va dans "later" avec une raison courte. Ne mets jamais une même tâche deux fois.
Dans "days", un élément par jour reçu, dans l'ordre, avec les tâches dans l'ordre où les faire et "tip" : un conseil d'une phrase pour ce jour.
"summary" : 2 phrases sur la semaine (charge, priorités). "advice" : 2 à 4 conseils concrets d'organisation pour cette semaine.`;

/** Builds the week's plan from the triaged tasks and the hours available each day. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { today, days, tasks, goals } = req.body as {
    today: string;
    /** What some projects should reach this week. */
    goals?: { project: string; goal: string }[];
    days: { date: string; label: string; hours: number }[];
    tasks: PlanTask[];
  };
  if (!days?.length || !tasks?.length) return res.status(400).send("Jours et tâches obligatoires.");

  const describe = (t: PlanTask) =>
    `- [${t.id}] ${t.name} (${t.domain}, ${t.list}) · ${t.important ? "important" : "pas important"}, ${
      t.urgent ? "urgent" : "pas urgent"
    } · ${t.estimate ? `${t.estimate} min` : "sans estimation"}${t.due ? ` · échéance ${t.due}` : ""}`;

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Nous sommes le ${today}. Mes disponibilités pour les tâches :
${days.map((d) => `- ${d.date} (${d.label}) : ${d.hours} h`).join("\n")}

${goals?.length ? `Mes objectifs de la semaine par projet (à servir en priorité) :\n${goals.map((g) => `- ${g.project} : ${g.goal}`).join("\n")}\n\n` : ""}Mes tâches triées :
${tasks.map(describe).join("\n")}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucun plan généré.");
    }
    // Only known tasks, each once.
    const known = new Set(tasks.map((t) => t.id));
    const seen = new Set<string>();
    const keep = (id: string) => known.has(id) && !seen.has(id) && seen.add(id);
    const plan = response.parsed_output;
    res.json({
      ...plan,
      days: plan.days.filter((d) => days.some((x) => x.date === d.date)).map((d) => ({ ...d, taskIds: d.taskIds.filter(keep) })),
      later: plan.later.filter((l) => keep(l.taskId)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le coach est indisponible.");
  }
}
