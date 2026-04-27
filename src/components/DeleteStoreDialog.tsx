import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  storeName: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

type CountRow = { label: string; count: number };

export default function DeleteStoreDialog({
  open, onOpenChange, storeId, storeName, onConfirm, isDeleting,
}: Props) {
  const [confirmText, setConfirmText] = useState("");

  const { data: counts, isLoading } = useQuery({
    queryKey: ["store-cascade-counts", storeId],
    queryFn: async (): Promise<CountRow[]> => {
      if (!storeId) return [];
      const head = (table: string) =>
        supabase.from(table as any).select("*", { count: "exact", head: true }).eq("store_id", storeId);

      const [
        rateio, status, occ, sched, schedHist, photos, contacts,
        lalLojas, portalTokens, compliance, occReports, maint, repl,
      ] = await Promise.all([
        head("campaign_store_pieces"),
        head("campaign_store_status"),
        head("occurrences"),
        head("campaign_schedules"),
        head("schedule_history"),
        head("installation_photos"),
        head("store_contacts"),
        head("loja_a_loja_lojas"),
        head("store_portal_tokens"),
        head("store_compliance_checks"),
        head("store_occurrence_reports"),
        head("store_maintenance_requests"),
        head("store_replacement_requests"),
      ]);

      return [
        { label: "Quantidades de peças (Rateio)", count: rateio.count || 0 },
        { label: "Status por campanha", count: status.count || 0 },
        { label: "Ocorrências", count: occ.count || 0 },
        { label: "Agendamentos", count: sched.count || 0 },
        { label: "Histórico de agendamentos", count: schedHist.count || 0 },
        { label: "Fotos de instalação", count: photos.count || 0 },
        { label: "Contatos", count: contacts.count || 0 },
        { label: "Loja a Loja", count: lalLojas.count || 0 },
        { label: "Tokens do portal", count: portalTokens.count || 0 },
        { label: "Conformidade", count: compliance.count || 0 },
        { label: "Relatos de ocorrência (portal)", count: occReports.count || 0 },
        { label: "Solicitações de manutenção", count: maint.count || 0 },
        { label: "Solicitações de reposição", count: repl.count || 0 },
      ];
    },
    enabled: open && !!storeId,
  });

  const visibleCounts = useMemo(() => (counts || []).filter((r) => r.count > 0), [counts]);
  const canDelete = confirmText.trim() === storeName.trim() && !isDeleting;

  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirmText("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir loja "{storeName}"?
          </DialogTitle>
          <DialogDescription>
            Esta ação é <strong>permanente</strong> e não pode ser desfeita. Todos os dados vinculados
            a esta loja serão removidos junto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive mb-2">Será apagado em cascata:</p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando impacto…
              </div>
            ) : visibleCounts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Apenas o cadastro da loja (nenhum dado vinculado).
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {visibleCounts.map((r) => (
                  <li key={r.label} className="flex justify-between">
                    <span className="text-foreground/80">{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-store-name" className="text-xs">
              Para confirmar, digite o nome da loja: <strong>{storeName}</strong>
            </Label>
            <Input
              id="confirm-store-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={storeName}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete}
          >
            {isDeleting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo…</>
            ) : (
              "Excluir definitivamente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
