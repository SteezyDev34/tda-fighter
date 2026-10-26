/** Google Calendar's event colors (colorId "1" to "11"). */
export const GCAL_COLORS = [
  { id: "9", name: "Myrtille", hex: "#3f51b5" },
  { id: "6", name: "Mandarine", hex: "#f4511e" },
  { id: "10", name: "Basilic", hex: "#0b8043" },
  { id: "3", name: "Raisin", hex: "#8e24aa" },
  { id: "5", name: "Banane", hex: "#f6bf26" },
  { id: "7", name: "Paon", hex: "#039be5" },
  { id: "4", name: "Flamant", hex: "#e67c73" },
  { id: "2", name: "Sauge", hex: "#33b679" },
  { id: "11", name: "Tomate", hex: "#d50000" },
  { id: "1", name: "Lavande", hex: "#7986cb" },
  { id: "8", name: "Graphite", hex: "#616161" },
];

export const colorHex = (id: string) => GCAL_COLORS.find((c) => c.id === id)?.hex ?? "#616161";
