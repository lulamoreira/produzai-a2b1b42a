// ─── Centralized Occurrence Constants ────────────────────

/** Priority options used across occurrence UI */
export const PRIORITY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "critica", label: "Crítica", color: "#dc2626" },
  { value: "alta", label: "Alta", color: "#f97316" },
  { value: "media", label: "Média", color: "#eab308" },
  { value: "baixa", label: "Baixa", color: "#22c55e" },
];

/** Special reporter type constants */
export const SPECIAL_AGENCY = "__agency__";
export const SPECIAL_FORNECEDOR = "__fornecedor__";
export const SPECIAL_CLIENTE = "__cliente__";

/** Special location constants */
export const GERAL_LOCATION = "__GERAL__";
export const NAO_SEI_LOCATION = "__NAO_SEI__";

/** Max photos per occurrence entry */
export const MAX_OCCURRENCE_PHOTOS = 3;
