/** Maps each Brazilian state (UF) to a distinct HSL background + text color pair */
const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  AC: { bg: "hsl(0 70% 93%)",   text: "hsl(0 60% 35%)" },
  AL: { bg: "hsl(15 70% 93%)",  text: "hsl(15 60% 35%)" },
  AM: { bg: "hsl(30 70% 93%)",  text: "hsl(30 60% 35%)" },
  AP: { bg: "hsl(45 70% 93%)",  text: "hsl(45 55% 30%)" },
  BA: { bg: "hsl(60 60% 91%)",  text: "hsl(60 50% 28%)" },
  CE: { bg: "hsl(80 55% 91%)",  text: "hsl(80 50% 28%)" },
  DF: { bg: "hsl(100 50% 92%)", text: "hsl(100 45% 30%)" },
  ES: { bg: "hsl(120 45% 92%)", text: "hsl(120 40% 30%)" },
  GO: { bg: "hsl(140 50% 92%)", text: "hsl(140 45% 28%)" },
  MA: { bg: "hsl(160 50% 92%)", text: "hsl(160 45% 28%)" },
  MG: { bg: "hsl(180 45% 92%)", text: "hsl(180 40% 28%)" },
  MS: { bg: "hsl(195 55% 92%)", text: "hsl(195 50% 28%)" },
  MT: { bg: "hsl(210 55% 93%)", text: "hsl(210 50% 30%)" },
  PA: { bg: "hsl(225 55% 93%)", text: "hsl(225 50% 32%)" },
  PB: { bg: "hsl(240 50% 93%)", text: "hsl(240 45% 35%)" },
  PE: { bg: "hsl(255 50% 93%)", text: "hsl(255 45% 35%)" },
  PI: { bg: "hsl(270 50% 93%)", text: "hsl(270 45% 35%)" },
  PR: { bg: "hsl(285 50% 93%)", text: "hsl(285 45% 35%)" },
  RJ: { bg: "hsl(300 45% 93%)", text: "hsl(300 40% 33%)" },
  RN: { bg: "hsl(315 50% 93%)", text: "hsl(315 45% 33%)" },
  RO: { bg: "hsl(330 50% 93%)", text: "hsl(330 45% 33%)" },
  RR: { bg: "hsl(345 50% 93%)", text: "hsl(345 45% 33%)" },
  RS: { bg: "hsl(10 60% 93%)",  text: "hsl(10 55% 35%)" },
  SC: { bg: "hsl(50 65% 91%)",  text: "hsl(50 55% 28%)" },
  SE: { bg: "hsl(170 50% 92%)", text: "hsl(170 45% 28%)" },
  SP: { bg: "hsl(200 60% 92%)", text: "hsl(200 55% 30%)" },
  TO: { bg: "hsl(90 50% 91%)",  text: "hsl(90 45% 28%)" },
};

const FALLBACK = { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" };

export function getStateColor(uf: string | null | undefined) {
  if (!uf) return FALLBACK;
  return STATE_COLORS[uf.toUpperCase().trim()] || FALLBACK;
}
