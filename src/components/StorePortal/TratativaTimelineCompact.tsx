import { useState } from "react";
import { PackageCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDayMonth, localTodayISO, type TratativaTimeline } from "@/lib/tratativaTimeline";
import { TONE_PILL_CLASS, STEP_BAR_CLASS } from "@/components/tratativa/timelineStyles";

interface Props {
  occurrenceId: string;
  timeline: TratativaTimeline;
  reinstallationOs?: string | null;
  /** Mostrar o botão "O material chegou" (regra decidida pelo chamador). */
  canConfirmArrival: boolean;
  /** Token da loja (URL /loja/:token), exigido pela confirmação. */
  storeToken?: string;
  onConfirmed: () => void;
}

type ConfirmResult = { ok: boolean; error?: string } | null;

function errorMessage(error: string | undefined): string {
  if (error === "already_confirmed") return "A chegada já tinha sido confirmada.";
  if (error === "invalid_token" || error === "not_found") return "Não foi possível confirmar. Atualize a página.";
  return "Não foi possível confirmar a chegada.";
}

/** Linha do tempo compacta e só leitura do portal do lojista. */
export function TratativaTimelineCompact({
  occurrenceId,
  timeline,
  reinstallationOs,
  canConfirmArrival,
  storeToken,
  onConfirmed,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const today = localTodayISO();

  async function handleConfirm() {
    if (!storeToken) { toast.error(errorMessage("invalid_token")); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("confirm_material_arrival_by_store" as any, {
        p_token: storeToken,
        p_occurrence_id: occurrenceId,
        p_arrived_date: today,
      } as any);
      if (error) throw error;
      const result = data as ConfirmResult;
      if (result?.ok) {
        toast.success("Chegada confirmada");
        setConfirmOpen(false);
        onConfirmed();
      } else {
        toast.error(errorMessage(result?.error));
        if (result?.error === "already_confirmed") { setConfirmOpen(false); onConfirmed(); }
      }
    } catch (e) {
      console.error("Supabase Error [confirm_material_arrival_by_store]:", e);
      toast.error(errorMessage(undefined));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <span className={cn("inline-flex text-xs font-medium px-2 py-0.5 rounded-full border", TONE_PILL_CLASS[timeline.tone])}>
        {timeline.headline}
      </span>

      <div className="flex gap-1" aria-hidden>
        {timeline.steps.map((s) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", STEP_BAR_CLASS[s.state])} />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-0.5" aria-label="Etapas da tratativa">
        {timeline.steps.map((s) => (
          <li key={s.key} className={cn("text-[11px]", s.state === "late" ? "text-destructive font-medium" : "text-muted-foreground")}>
            <span className={cn(s.state === "done" && "text-foreground")}>{s.label}</span>
            {s.shortDateLabel && <> · {s.isForecast ? `prev. ${s.shortDateLabel}` : s.shortDateLabel}</>}
          </li>
        ))}
      </ul>

      {timeline.nextStep && <p className="text-xs text-foreground">{timeline.nextStep}</p>}
      {reinstallationOs && <p className="text-[11px] text-muted-foreground">OS da reinstalação: {reinstallationOs}</p>}

      {canConfirmArrival && (
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto gap-1.5 mt-1"
          disabled={sending}
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
          O material chegou
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!sending) setConfirmOpen(o); }}>
        {/* stopPropagation: o portal do diálogo repassa cliques ao card (que abriria/fecharia). */}
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar chegada do material</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar que o material chegou na loja hoje ({formatDayMonth(today)})? Não é possível desfazer por aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => { e.preventDefault(); void handleConfirm(); }}
            >
              {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirmando...</> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
