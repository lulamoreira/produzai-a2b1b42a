import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOWERCASE_WORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos",
  "em", "na", "no", "nas", "nos",
  "por", "para", "com", "sem", "sob", "sobre",
  "entre", "até", "após", "ante", "perante",
  "e", "ou", "mas", "nem", "que", "se", "pois",
  "logo", "porém", "contudo", "todavia", "entretanto", "portanto"
]);

/** Capitalizes each word except for small Portuguese words (unless first word): "LUIS DA SILVA" → "Luis da Silva" */
export function capitalizeName(name: string | null | undefined): string {
  if (!name) return "";
  const cleaned = name.replace(/\s+/g, " ").trim();
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      if (LOWERCASE_WORDS.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
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
