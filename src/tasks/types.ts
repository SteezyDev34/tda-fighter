/** ClickUp data as the app keeps it (trimmed from the ClickUp API). */
export interface CuList {
  id: string;
  name: string;
  folder?: string;
  folderId?: string;
}

export interface CuSpace {
  id: string;
  name: string;
  /** Projects of the space (ClickUp folders). Missing in data saved before. */
  folders?: { id: string; name: string }[];
  lists: CuList[];
}

export type Priority = "urgent" | "high" | "normal" | "low";

export interface CuTask {
  id: string;
  name: string;
  description?: string;
  status: string;
  closed: boolean;
  /** Due date, in ms. */
  due?: number;
  priority?: Priority;
  /** Set on subtasks: the parent task's id. */
  parent?: string;
  listId: string;
  listName: string;
  folderName?: string;
  spaceId: string;
  url: string;
  updated: number;
  /** Time estimate, in ms. */
  estimate?: number;
}

export type Domain = "pro" | "perso";

export const PRIORITIES: { id: Priority; label: string; rank: number }[] = [
  { id: "urgent", label: "Urgent", rank: 0 },
  { id: "high", label: "Haute", rank: 1 },
  { id: "normal", label: "Normale", rank: 2 },
  { id: "low", label: "Basse", rank: 3 },
];

export const priorityRank = (p?: Priority) => PRIORITIES.find((x) => x.id === p)?.rank ?? 2;
