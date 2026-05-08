import React from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UploadStatus } from "@/lib/budgetEmailUpload";

interface Props {
  status: UploadStatus | null;
  className?: string;
}

/**
 * Small inline progress + status panel for upload/signing operations.
 * Renders nothing when status is null.
 */
export function UploadProgressPanel({ status, className }: Props) {
  if (!status) return null;
  const isRetry = status.phase === "retrying";
  return (
    <div
      className={
        "rounded-md border border-border bg-muted/40 p-3 space-y-2 " +
        (className ?? "")
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className={isRetry ? "text-amber-700 dark:text-amber-300" : "text-foreground"}>
          {status.message}
        </span>
      </div>
      <Progress value={status.progress} className="h-2" />
    </div>
  );
}
