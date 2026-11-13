import type { TimelineStepState, TimelineTone, ReinstallBadge } from "@/lib/tratativaTimeline";

/** Pílula do headline, por tom. Só tokens semânticos (funciona no tema escuro). */
export const TONE_PILL_CLASS: Record<TimelineTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-primary/10 text-primary border-primary/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

/** Bolinha da etapa: verde = feito, laranja = atual, vermelho = atrasado, cinza = a fazer. */
export const STEP_DOT_CLASS: Record<TimelineStepState, string> = {
  done: "bg-success text-primary-foreground border-success",
  current: "bg-primary text-primary-foreground border-primary",
  late: "bg-destructive text-primary-foreground border-destructive",
  todo: "bg-muted text-muted-foreground border-border",
};

/** Segmento da barra de progresso compacta. */
export const STEP_BAR_CLASS: Record<TimelineStepState, string> = {
  done: "bg-success",
  current: "bg-primary",
  late: "bg-destructive",
  todo: "bg-muted",
};

/** Linha que liga uma etapa à próxima. */
export const STEP_LINE_CLASS: Record<TimelineStepState, string> = {
  done: "bg-success/60",
  current: "bg-border",
  late: "bg-border",
  todo: "bg-border",
};

export const REINSTALL_BADGE: Record<ReinstallBadge, { label: string; className: string }> = {
  prevista: { label: "prevista", className: "bg-muted text-muted-foreground border-border" },
  confirmada: { label: "confirmada", className: "bg-success/15 text-success border-success/30" },
  remarcar: { label: "remarcar", className: "bg-destructive/10 text-destructive border-destructive/30" },
};
