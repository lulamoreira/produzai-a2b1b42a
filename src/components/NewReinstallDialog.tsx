import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface NewReinstallDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  storeId: string;
  storeName: string;
  parentInstallationId: string;
  currentMaxSeq: number;
}

export default function NewReinstallDialog({
  open,
  onOpenChange,
  campaignId,
  storeId,
  storeName,
  parentInstallationId,
  currentMaxSeq,
}: NewReinstallDialogProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const nextSeq = currentMaxSeq + 1;

  const reset = () => {
    setReason("");
    setScheduledDate(undefined);
    setSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Informe o motivo da reinstalação");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("campaign_schedules").insert({
      campaign_id: campaignId,
      store_id: storeId,
      reinstall_seq: nextSeq,
      reinstall_reason: reason.trim(),
      parent_installation_id: parentInstallationId,
      scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Erro ao criar reinstalação");
      return;
    }
    qc.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
    toast.success(`Reinstalação #${nextSeq} criada`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            Nova reinstalação — {storeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reinstall-reason">
              Motivo da reinstalação <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reinstall-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Troca de mobiliário no setor de chocolates"
              rows={3}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label>Data prevista para nova instalação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : <span>Selecionar data (opcional)</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Esta nova instalação será criada como reinstalação <strong>#{nextSeq}</strong> desta loja.
              As ocorrências continuarão no card existente. O motivo poderá ser editado depois.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !reason.trim()}>
            {submitting ? "Criando..." : "✅ Criar reinstalação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
