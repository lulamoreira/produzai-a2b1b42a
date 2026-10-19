import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { defaultExecutionSource, executionImportDefaults, executionImportSummarySchema } from "@/lib/executionImport";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ImportExecutionDialogProps {
  campaignId: string;
  clientId: string;
  onClose: () => void;
}

export default function ImportExecutionDialog({ campaignId, clientId, onClose }: ImportExecutionDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [chosenSource, setChosenSource] = useState<string | null>(null);
  const [schedules, setSchedules] = useState(executionImportDefaults.schedules);
  const [photos, setPhotos] = useState(executionImportDefaults.photos);
  const campaigns = useQuery({
    queryKey: ["execution-import-campaigns", clientId, campaignId],
    queryFn: () => supabasePaginate<Pick<Tables<"campaigns">, "id" | "name" | "root_campaign_id" | "parent_campaign_id">>((from, to) =>
      supabase.from("campaigns").select("id,name,root_campaign_id,parent_campaign_id", { count: "exact" }).eq("client_id", clientId).order("id").range(from, to)),
  });
  const current = campaigns.data?.find(c => c.id === campaignId);
  const options = (campaigns.data || []).filter(c => c.id !== campaignId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const source = chosenSource ?? (current ? defaultExecutionSource(current, options.map(c => c.id)) : "");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!source || !(schedules || photos)) throw new Error(t("scheduling.importSelection", "Selecione a campanha de origem e o que importar."));
      const { data, error } = await supabase.rpc("import_campaign_execution", {
        p_source_campaign_id: source, p_target_campaign_id: campaignId, p_schedules: schedules, p_photos: photos,
      });
      if (error) throw error;
      return executionImportSummarySchema.parse(data);
    },
    onSuccess: () => {
      for (const key of ["campaign_schedules", "installation_photos", "installation_teams", "all_team_members", "all_team_vehicles", "team_store_counts"]) {
        void qc.invalidateQueries({ queryKey: [key, campaignId] });
      }
      toast.success(t("scheduling.importDone", "Importação concluída."));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const summary = mutation.data;
  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{t("scheduling.importExecution", "Importar agendamento/instalações de outra campanha")}</DialogTitle>
        </DialogHeader>
        {summary ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm" aria-live="polite">
            <dt>{t("scheduling.importedSchedules", "Agendamentos importados")}</dt><dd className="font-semibold">{summary.schedules_imported}</dd>
            <dt>{t("scheduling.skippedSchedules", "Pulados (já existiam)")}</dt><dd className="font-semibold">{summary.schedules_skipped}</dd>
            <dt>{t("scheduling.createdTeams", "Equipes criadas")}</dt><dd className="font-semibold">{summary.teams_created}</dd>
            <dt>{t("scheduling.reusedTeams", "Equipes reutilizadas")}</dt><dd className="font-semibold">{summary.teams_reused}</dd>
            <dt>{t("scheduling.importedPhotos", "Fotos/registros de mídia importados")}</dt><dd className="font-semibold">{summary.photos_imported}</dd>
          </dl>
        ) : campaigns.isPending ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t("common.loading", "Carregando")} /></div>
        ) : campaigns.isError ? (
          <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{t("scheduling.importLoadError", "Não foi possível carregar as campanhas.")}</p><Button variant="outline" onClick={() => void campaigns.refetch()}>{t("common.retry", "Tentar novamente")}</Button></div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="execution-source">{t("scheduling.sourceCampaign", "Campanha de origem")}</Label>
              <Select value={source || "__none__"} onValueChange={value => setChosenSource(value === "__none__" ? "" : value)} disabled={mutation.isPending}>
                <SelectTrigger id="execution-source" className="h-auto min-h-10 [&>span]:whitespace-normal [&>span]:text-left"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>{t("scheduling.chooseCampaign", "Selecione uma campanha")}</SelectItem>
                  {options.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {options.length === 0 && <p className="text-sm text-muted-foreground">{t("scheduling.noSourceCampaign", "Nenhuma outra campanha disponível para este cliente.")}</p>}
            </div>
            <div className="flex items-center gap-2"><Checkbox id="import-schedules" checked={schedules} onCheckedChange={value => setSchedules(value === true)} disabled={mutation.isPending} /><Label htmlFor="import-schedules">{t("scheduling.title", "Agendamento")}</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="import-photos" checked={photos} onCheckedChange={value => setPhotos(value === true)} disabled={mutation.isPending} /><Label htmlFor="import-photos">{t("scheduling.importPhotos", "Fotos/registros de instalação")}</Label></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>{summary ? t("common.close", "Fechar") : t("common.cancel", "Cancelar")}</Button>
          {!summary && <Button onClick={() => mutation.mutate()} disabled={!source || !(schedules || photos) || campaigns.isPending || campaigns.isError || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {mutation.isPending ? t("common.importing", "Importando...") : t("common.import", "Importar")}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}