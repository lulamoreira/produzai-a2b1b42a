import type { RateioFinding } from "@/lib/reviewRateio";

/** Selos de severidade da "Revisar Rateio" (diálogo e ficha da loja usam os mesmos). */
export const SEV_STYLE: Record<RateioFinding["severity"], string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-amber-500/90 text-white",
  baixa: "bg-muted text-muted-foreground",
};
export const SEV_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
