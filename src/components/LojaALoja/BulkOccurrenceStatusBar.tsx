import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export interface BulkStatusOption {
  value: string;
  label: string;
}

export interface BulkOccurrenceStatusBarProps {
  campaignId: string;
  selectedIds: string[];
  storeCount: number;
  statusOptions: BulkStatusOption[];
  onClear: () => void;
}

/**
 * Barra de ações exibida quando há ocorrências marcadas (somente admin/master).
 * A alteração é feita por uma única chamada no servidor, que revalida a permissão.
 */
export default function BulkOccurrenceStatusBar({
  campaignId,
  selectedIds,
  storeCount,
  statusOptions,
  onClear,
}: BulkOccurrenceStatusBarProps) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  const statusLabel = statusOptions.find((s) => s.value === status)?.label ?? status;

  async function apply() {
    if (!status || count === 0) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase.rpc as never as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: number | null; error: { message: string } | null }>)("bulk_update_occurrence_status", {
        _campaign_id: campaignId,
        _occurrence_ids: selectedIds,
        _status: status,
      });
      if (error) throw new Error(error.message);
      const changed = data ?? 0;
      const unchanged = count - changed;
      toast.success(
        `${changed} ocorrência(s) alterada(s) para "${statusLabel}"` +
          (unchanged > 0 ? ` · ${unchanged} já estava(m) nesse status` : ""),
      );
      qc.invalidateQueries({ queryKey: ["portal-occurrences-v2", campaignId] });
      qc.invalidateQueries({ queryKey: ["portal-occurrences-by-store", campaignId] });
      qc.invalidateQueries({ queryKey: ["loja-a-loja-dashboard", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-status-dashboard", campaignId] });
      setStatus("");
      onClear();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao alterar status: " + msg);
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label="Ações em lote"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
      >
        <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">
          {count} selecionada(s) · {storeCount} loja(s)
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Novo status">
              <SelectValue placeholder="Escolha o novo status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!status || saving} onClick={() => setConfirmOpen(true)}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Alterar status
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onClear} disabled={saving}>
            <X className="h-3.5 w-3.5" />
            Limpar seleção
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              {count} ocorrência(s) de {storeCount} loja(s) passarão para "{statusLabel}". As demais informações de cada
              ocorrência não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void apply();
              }}
            >
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
