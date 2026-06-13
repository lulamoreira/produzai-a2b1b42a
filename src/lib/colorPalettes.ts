export type ColorPaletteId =
  | "tangerina" | "rubi" | "oceano" | "floresta"
  | "marfim" | "grafite" | "orgulho" | "classico"
  | "terracota" | "ametista" | "turquesa" | "magenta";

export type ColorThemePreference = ColorPaletteId | "auto";

export interface ColorPalette {
  id: ColorPaletteId;
  label: string;
  bg: string;
  surface: string;
  accent: string;
  accentStrong: string;
  text: string;
  isDark: boolean;
}

export const COLOR_PALETTES: ColorPalette[] = [
  { id: "tangerina", label: "Tangerina", bg: "#FFF4ED", surface: "#FFE0CC", accent: "#F2742B", accentStrong: "#C2410C", text: "#5A2A0E", isDark: false },
  { id: "rubi",      label: "Rubi",      bg: "#FFF1F1", surface: "#FBD0D0", accent: "#DC2626", accentStrong: "#991B1B", text: "#4A0E0E", isDark: false },
  { id: "oceano",    label: "Oceano",    bg: "#EEF5FC", surface: "#CADFF5", accent: "#2563EB", accentStrong: "#1E40AF", text: "#0F2A52", isDark: false },
  { id: "floresta",  label: "Floresta",  bg: "#EFF6EC", surface: "#CCE8C4", accent: "#2F9E44", accentStrong: "#1B6E2E", text: "#133A18", isDark: false },
  { id: "marfim",    label: "Marfim",    bg: "#FAF8F3", surface: "#ECE7DC", accent: "#C9B68C", accentStrong: "#8A6D3B", text: "#3A3326", isDark: false },
  { id: "grafite",   label: "Grafite",   bg: "#16181D", surface: "#23262E", accent: "#5B8DEF", accentStrong: "#8AA4F2", text: "#E6E8EC", isDark: true  },
  { id: "orgulho",   label: "Orgulho",   bg: "#1E1B2E", surface: "#2E2640", accent: "#7B2FBE", accentStrong: "#F77F00", text: "#F4F1FA", isDark: true  },
  { id: "classico",  label: "Clássico",  bg: "#FFFFFF", surface: "#F2F2F0", accent: "#3A3A38", accentStrong: "#161615", text: "#161615", isDark: false },
  { id: "terracota", label: "Terracota", bg: "#F6EFE7", surface: "#E4D3C0", accent: "#B5651D", accentStrong: "#8A5A2B", text: "#4A3526", isDark: false },
  { id: "ametista",  label: "Ametista",  bg: "#F4EFFB", surface: "#DECFF5", accent: "#7C3AED", accentStrong: "#5B21B6", text: "#2E1065", isDark: false },
  { id: "turquesa",  label: "Turquesa",  bg: "#EAF7F5", surface: "#C2EAE3", accent: "#0EA5A5", accentStrong: "#0F766E", text: "#0A3D38", isDark: false },
  { id: "magenta",   label: "Magenta",   bg: "#FDEEF5", surface: "#F8CCE0", accent: "#DB2777", accentStrong: "#9D174D", text: "#500724", isDark: false },
];

export const DEFAULT_PALETTE: ColorPaletteId = "terracota";
export const AUTO_LIGHT_PALETTE: ColorPaletteId = "terracota";
export const AUTO_DARK_PALETTE: ColorPaletteId = "grafite";
export const PALETTE_IDS = COLOR_PALETTES.map(p => p.id);

export function isValidPalette(id: string | null | undefined): id is ColorPaletteId {
  return !!id && (PALETTE_IDS as string[]).includes(id);
}

export function isValidPreference(id: string | null | undefined): id is ColorThemePreference {
  return id === "auto" || isValidPalette(id);
}

export function getPaletteById(id: ColorPaletteId): ColorPalette {
  return COLOR_PALETTES.find(p => p.id === id) ?? COLOR_PALETTES.find(p => p.id === DEFAULT_PALETTE)!;
}
