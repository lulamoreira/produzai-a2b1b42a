/**
 * Applies a user-chosen hue (0–360) to generate a full brand color palette
 * and injects it as CSS custom properties on :root.
 *
 * Status colors (success, warning, danger) are NEVER affected.
 */
export function applyUserTheme(hue: number) {
  const root = document.documentElement;

  // Brand palette
  root.style.setProperty("--brand-50", `${hue} 90% 97%`);
  root.style.setProperty("--brand-100", `${hue} 85% 93%`);
  root.style.setProperty("--brand-200", `${hue} 80% 86%`);
  root.style.setProperty("--brand-400", `${hue} 75% 65%`);
  root.style.setProperty("--brand-500", `${hue} 72% 52%`);
  root.style.setProperty("--brand-600", `${hue} 72% 42%`);
  root.style.setProperty("--brand-700", `${hue} 72% 32%`);
  root.style.setProperty("--brand-900", `${hue} 72% 18%`);

  // Override primary to match brand
  root.style.setProperty("--primary", `${hue} 72% 52%`);
  root.style.setProperty("--ring", `${hue} 72% 52%`);

  // Sidebar — dark tone derived from hue
  root.style.setProperty("--sidebar-background", `${hue} 25% 11%`);
  root.style.setProperty("--sidebar-accent", `${hue} 30% 18%`);
  root.style.setProperty("--sidebar-foreground", `${hue} 15% 68%`);
  root.style.setProperty("--sidebar-accent-foreground", `${hue} 10% 94%`);
  root.style.setProperty("--sidebar-primary", `${hue} 72% 65%`);
  root.style.setProperty("--sidebar-border", `${hue} 18% 20%`);
  root.style.setProperty("--sidebar-ring", `${hue} 72% 52%`);
}

export function resetUserTheme() {
  const root = document.documentElement;
  const props = [
    "--brand-50", "--brand-100", "--brand-200", "--brand-400",
    "--brand-500", "--brand-600", "--brand-700", "--brand-900",
    "--primary", "--ring",
    "--sidebar-background", "--sidebar-accent", "--sidebar-foreground",
    "--sidebar-accent-foreground", "--sidebar-primary", "--sidebar-border", "--sidebar-ring",
  ];
  props.forEach(p => root.style.removeProperty(p));
}

export const THEME_PRESETS = [
  { name: "Índigo", hue: 231 },
  { name: "Azul Oceano", hue: 210 },
  { name: "Verde Musgo", hue: 152 },
  { name: "Esmeralda", hue: 162 },
  { name: "Teal", hue: 180 },
  { name: "Âmbar", hue: 38 },
  { name: "Laranja", hue: 22 },
  { name: "Coral", hue: 14 },
  { name: "Rosa", hue: 335 },
  { name: "Roxo", hue: 270 },
  { name: "Vermelho", hue: 0 },
  { name: "Grafite", hue: 220 },
] as const;
