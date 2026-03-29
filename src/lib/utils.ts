import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitalizes each word: "LUIS MOREIRA" → "Luis Moreira" */
export function capitalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const PT_LOWERCASE_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** Normalize team name: UPPERCASE, trim, collapse spaces */
export function normalizeTeamName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Normalize member name: Title Case with PT preposition exceptions */
export function normalizeMemberName(name: string | null | undefined): string {
  if (!name) return "";
  const cleaned = name.replace(/\s+/g, " ").trim();
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i > 0 && PT_LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
