import Anthropic from "@anthropic-ai/sdk";
import type { JournalEntry, NutritionProfile } from "../../src/nutrition/types";
import { loadKnowledge } from "./knowledge.js";
import { slotLabel } from "./shared.js";

export const client = new Anthropic();
export const MODEL = "claude-opus-5-5";

const ROLE = `Tu es le coach nutrition de TDA Fighter, une app pour les personnes TDAH.
Réponds en français, avec des phrases courtes et des actions concrètes. Pas de culpabilisation.
Appuie-toi d'abord sur les ressources nutritionnelles fournies (balises <document>), puis sur les critères et le journal de la personne.
Si les ressources ne couvrent pas la question, dis-le et donne un conseil prudent et général.
Tu ne poses pas de diagnostic médical ; en cas de doute de santé, oriente vers un professionnel.`;

const CRITERIA_LABELS: Record<string, string> = {
  body: "moi (sexe, âge, poids, taille, activité, protocole)",
  goal: "objectif",
  likes: "j'aime",
  dislikes: "je n'aime pas",
  allergies: "allergies ou intolérances",
  budget: "budget",
  cookingTime: "temps pour cuisiner",
};

function describeContext(profile: NutritionProfile, journal: JournalEntry[]) {
  const { targets, ...text } = profile;
  const criteria = [
    ...Object.entries(text)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => `- ${CRITERIA_LABELS[k] ?? k} : ${v}`),
    ...(targets
      ? [`- objectifs journaliers : ${targets.kcal} kcal, ${targets.protein} g protéines, ${targets.carbs} g glucides, ${targets.fat} g lipides`]
      : []),
  ].join("\n");
  const eaten = journal
    .map((e) => {
      const n = e.nutrients;
      const macros = n ? ` (${n.kcal} kcal, P ${n.protein} g, G ${n.carbs} g, L ${n.fat} g)` : "";
      return `- ${e.date} · ${slotLabel(e.slot)} : ${e.description}${macros}`;
    })
    .join("\n");
  return `<criteres>\n${criteria || "Aucun critère renseigné."}\n</criteres>
<journal date_du_jour="${new Date().toISOString().slice(0, 10)}">\n${eaten || "Journal vide."}\n</journal>`;
}

/**
 * System prompt: the stable part (role + Drive knowledge) is cached,
 * the personal context (criteria + journal) changes on every request.
 */
export async function buildSystem(
  profile: NutritionProfile,
  journal: JournalEntry[],
): Promise<Anthropic.TextBlockParam[]> {
  const knowledge = await loadKnowledge();
  return [
    {
      type: "text",
      text: `${ROLE}\n\n<ressources>\n${knowledge || "Aucune ressource chargée."}\n</ressources>`,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: describeContext(profile, journal) },
  ];
}
