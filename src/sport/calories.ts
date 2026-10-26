import type { Intensity, SportSession } from "./types";

/**
 * MET values (energy cost as a multiple of rest) from the Compendium of
 * Physical Activities, for easy / medium / hard effort.
 */
const METS: Record<string, [number, number, number]> = {
  muscu: [3.5, 5, 6],
  Course: [7, 9.8, 11.5],
  Vélo: [4, 6.8, 10],
  Natation: [6, 8.3, 10],
  Marche: [3, 3.5, 5],
  Rameur: [4.8, 7, 8.5],
  Elliptique: [5, 6, 8],
  "Corde à sauter": [8.8, 11.8, 12.3],
  HIIT: [6, 8, 10],
  autre: [4, 6, 8],
};

const LEVEL: Record<Intensity, 0 | 1 | 2> = { facile: 0, moyen: 1, dur: 2 };

/** Weight in kg read from the "Moi" criteria ("…, 85 kg, …"). */
export function weightFrom(text: string) {
  const m = text.match(/(\d{2,3}(?:[.,]\d+)?)\s*kg/i);
  const kg = m ? Number(m[1].replace(",", ".")) : NaN;
  return kg >= 30 && kg <= 250 ? kg : undefined;
}

/**
 * Calories burned, estimated as MET × weight × hours. A run with its distance
 * uses about 1 kcal per kg per km, which does not depend on the pace.
 */
export function estimateKcal(s: SportSession, kg: number | undefined) {
  if (!kg || !s.duration) return undefined;
  if (s.kind === "cardio" && s.name === "Course" && s.distance) return Math.round(kg * s.distance);
  const mets = s.kind === "muscu" ? METS.muscu : (METS[s.name] ?? METS.autre);
  return Math.round(mets[LEVEL[s.intensity ?? "moyen"]] * kg * (s.duration / 60));
}

/** The watch's figure when given, otherwise the estimate. */
export function sessionKcal(s: SportSession, kg: number | undefined) {
  return s.kcal ? { kcal: s.kcal, measured: true } : { kcal: estimateKcal(s, kg), measured: false };
}
