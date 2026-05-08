import React from "react";
import { CheckCircle2, XCircle, FileText, Link2, Mail, MessageCircle } from "lucide-react";

export type SummaryItemKind = "file" | "email" | "whatsapp";
export type SummaryItemStage = "generated" | "signed" | "sent" | "failed";

export interface SendSummaryItem {
  kind: SummaryItemKind;
  label: string;
  /** Highest stage reached for this item. */
  stage: SummaryItemStage;
  /** When stage === "failed", a short error description. */
  error?: string;
}

interface Props {
  items: SendSummaryItem[];
  className?: string;
}

const stageMeta: Record<
  SummaryItemStage,
  { label: string; tone: "ok" | "warn" | "err" }
> = {
  generated: { label: "Gerada", tone: "warn" },
  signed: { label: "Link assinado", tone: "warn" },
  sent: { label: "Enviado", tone: "ok" },
  failed: { label: "Falhou", tone: "err" },
};

function KindIcon({ kind, stage }: { kind: SummaryItemKind; stage: SummaryItemStage }) {
  const cls = "w-4 h-4 shrink-0";
  if (stage === "failed") return <XCircle className={cls + " text-red-600 dark:text-red-400"} />;
  if (kind === "email") return <Mail className={cls + " text-emerald-600 dark:text-emerald-400"} />;
  if (kind === "whatsapp") return <MessageCircle className={cls + " text-emerald-600 dark:text-emerald-400"} />;
  if (stage === "sent") return <CheckCircle2 className={cls + " text-emerald-600 dark:text-emerald-400"} />;
  if (stage === "signed") return <Link2 className={cls + " text-amber-600 dark:text-amber-400"} />;
  return <FileText className={cls + " text-amber-600 dark:text-amber-400"} />;
}

/**
 * Renders a final summary of all generated/signed/sent items after a
 * budget upload-and-send operation. Shows nothing when items is empty.
 */
export function SendSummaryPanel({ items, className }: Props) {
  if (!items || items.length === 0) return null;

  const counts = items.reduce(
    (acc, it) => {
      if (it.stage === "failed") acc.failed += 1;
      else if (it.stage === "sent") acc.sent += 1;
      else if (it.stage === "signed") acc.signed += 1;
      else acc.generated += 1;
      return acc;
    },
    { generated: 0, signed: 0, sent: 0, failed: 0 },
  );

  const allOk = counts.failed === 0;

  return (
    <div
      className={
        "rounded-md border p-3 space-y-2 " +
        (allOk
          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 "
          : "border-amber-300 bg-amber-50 dark:bg-amber-950/20 ") +
        (className ?? "")
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {allOk ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        )}
        <span>Resumo do envio</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {counts.generated + counts.signed + counts.sent} planilha(s) processada(s) ·{" "}
        {counts.sent} enviada(s) · {counts.signed + counts.generated} pendente(s) ·{" "}
        <span className={counts.failed > 0 ? "text-red-700 dark:text-red-400 font-medium" : ""}>
          {counts.failed} falha(s)
        </span>
      </div>
      <ul className="space-y-1.5 max-h-48 overflow-auto">
        {items.map((it, i) => {
          const meta = stageMeta[it.stage];
          const toneCls =
            meta.tone === "ok"
              ? "text-emerald-700 dark:text-emerald-300"
              : meta.tone === "err"
              ? "text-red-700 dark:text-red-300"
              : "text-amber-700 dark:text-amber-300";
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <KindIcon kind={it.kind} stage={it.stage} />
              <div className="min-w-0 flex-1">
                <div className="truncate" title={it.label}>{it.label}</div>
                {it.stage === "failed" && it.error && (
                  <div className="text-red-700 dark:text-red-400 break-words">{it.error}</div>
                )}
              </div>
              <span className={"shrink-0 font-medium " + toneCls}>{meta.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
