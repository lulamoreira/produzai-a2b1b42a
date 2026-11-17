/**
 * "Exportar para campanha": copia peças e kits escolhidos para OUTRA campanha
 * do mesmo cliente (nova ou existente), com o rateio. É somente cópia — a
 * campanha de origem é apenas lida; toda gravação acontece no destino.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capitalizeName } from "@/lib/utils";
import { useClientStores } from "@/hooks/useMultiClientData";
import {
  customFieldWarnings, customFieldWarningText, disabledStoresWithQuantity, exportedRateioRows, exportItemCount,
  exportSummaryWithRateio, resolveExportSelection, usedCustomFields,
  type ExportSourceKit, type ExportSourceKitPiece, type ExportSourcePiece, type LocationRow, type SubLocationRow,
} from "@/lib/exportToCampaign";
import {
  ExportToCampaignError, readDisabledStoreIds, readStorePieces, runExportToCampaign, type ExportProgress, type ExportRunResult,
} from "@/lib/exportToCampaignRun";
import { ExportItemsPreview } from "@/components/exportToCampaign/ExportItemsPreview";
import { ExportResultView } from "@/components/exportToCampaign/ExportResultView";

export interface ExportToCampaignRequest {
  pieceIds: string[];
  kitIds: string[];
}

export interface ExportToCampaignDialogProps {
  request: ExportToCampaignRequest | null;
  onClose: () => void;
  agencyId: string;
  clientId: string;
  sourceCampaign: { id: string; name?: string | null } & Record<string, unknown>;
  pieces: ExportSourcePiece[];
  kits: ExportSourceKit[];
  kitPieces: ExportSourceKitPiece[];
  pieceLocations: LocationRow[];
  pieceSubLocations: SubLocationRow[];
}

type RemoteCampaign = { id: string; name: string };
const labelsOf = (c: Record<string, unknown> | null | undefined) =>
  [1, 2, 3, 4, 5].map((i) => (c?.[`piece_custom_field_${i}_label`] as string | null | undefined) ?? null);

export default function ExportToCampaignDialog({
  request, onClose, agencyId, clientId, sourceCampaign, pieces, kits, kitPieces, pieceLocations, pieceSubLocations,
}: ExportToCampaignDialogProps) {
  const navigate = useNavigate();
  const params = useParams<{ agencyId: string }>();
  const routeAgencyId = agencyId || params.agencyId || "";
  const qc = useQueryClient();
  const open = !!request;
  const [destKind, setDestKind] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [destId, setDestId] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportRunResult | null>(null);

  const selection = useMemo(
    () => resolveExportSelection({ pieceIds: request?.pieceIds ?? [], kitIds: request?.kitIds ?? [], pieces, kits, kitPieces }),
    [request, pieces, kits, kitPieces],
  );
  const itemCount = exportItemCount(selection);
  const sourceLabels = useMemo(() => labelsOf(sourceCampaign), [sourceCampaign]);
  const used = useMemo(() => usedCustomFields(selection.allPieces), [selection]);
  const exportedPieceIds = useMemo(() => selection.allPieces.map((p) => p.id).sort(), [selection]);

  // Rateio da origem das peças exportadas (somente leitura, paginado).
  const { data: sourceRateioAll, isError: rateioError } = useQuery({
    queryKey: ["export_source_rateio", sourceCampaign.id, exportedPieceIds],
    enabled: open && exportedPieceIds.length > 0,
    staleTime: 30_000,
    queryFn: () => readStorePieces(sourceCampaign.id, exportedPieceIds),
  });
  const sourceRateio = useMemo(
    () => (sourceRateioAll ? exportedRateioRows(sourceRateioAll, selection) : null),
    [sourceRateioAll, selection],
  );

  // Nomes das lojas do cliente (mesmo cache da campanha).
  const { data: clientStores = [] } = useClientStores(open ? clientId : undefined);
  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const st of clientStores as Array<{ id: string; name?: string | null; nickname?: string | null }>) {
      m.set(st.id, (st.nickname || st.name || "Loja").trim());
    }
    return m;
  }, [clientStores]);
  const sourceCodeById = useMemo(() => new Map(pieces.map((p) => [p.id, p.code])), [pieces]);

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["client_campaigns_for_import_rpc", clientId, sourceCampaign.id],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("get_client_campaigns_for_import", { p_client_id: clientId });
      if (rpcError) throw rpcError;
      return ((data as RemoteCampaign[]) || []).filter((c) => c.id !== sourceCampaign.id);
    },
  });

  const { data: destLabels } = useQuery({
    queryKey: ["campaign_custom_labels", destId],
    enabled: open && destKind === "existing" && !!destId,
    queryFn: async () => {
      const { data, error: readError } = await supabase
        .from("campaigns")
        .select("piece_custom_field_1_label, piece_custom_field_2_label, piece_custom_field_3_label, piece_custom_field_4_label, piece_custom_field_5_label")
        .eq("id", destId)
        .maybeSingle();
      if (readError) throw readError;
      return labelsOf(data as Record<string, unknown> | null);
    },
  });

  // Lojas desativadas no destino existente (o status do destino nunca é alterado).
  const { data: destDisabled } = useQuery({
    queryKey: ["export_dest_disabled_stores", destId],
    enabled: open && destKind === "existing" && !!destId,
    queryFn: () => readDisabledStoreIds(destId),
  });
  const disabledWithQty = destKind === "existing" && destDisabled && sourceRateio
    ? disabledStoresWithQuantity(sourceRateio, new Set(destDisabled))
    : [];

  const warnings = destKind === "existing" && destLabels ? customFieldWarnings(sourceLabels, destLabels, used) : [];
  const destCampaign = campaigns.find((c) => c.id === destId);
  const destLabel = destKind === "new" ? (newName.trim() ? capitalizeName(newName.trim()) : "nova campanha") : destCampaign?.name ?? "…";
  const rateioReady = exportedPieceIds.length === 0 || !!sourceRateio;
  const canSubmit = !running && !result && itemCount > 0 && rateioReady
    && (destKind === "new" ? newName.trim().length > 0 : !!destCampaign && !!destDisabled);

  const openDestination = (id: string) => {
    onClose();
    navigate(`/agency/${routeAgencyId}/clients/${clientId}/campaigns/${id}?section=pieces`);
  };

  const handleExport = async () => {
    if (!canSubmit) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runExportToCampaign({
        clientId,
        sourceCampaignId: sourceCampaign.id,
        selection,
        sourceLabels,
        sourceLocations: pieceLocations,
        sourceSubLocations: pieceSubLocations,
        destination: destKind === "new"
          ? { kind: "new", name: capitalizeName(newName.trim()) }
          : { kind: "existing", campaignId: destCampaign!.id, name: destCampaign!.name },
        onProgress: setProgress,
      });
      for (const key of ["campaign_pieces", "campaign_kits", "campaign_kit_pieces", "campaign_store_pieces", "campaign_store_status", "campaign_piece_locations", "campaign_piece_sub_locations", "campaign"]) {
        qc.invalidateQueries({ queryKey: [key, res.campaignId] });
      }
      qc.invalidateQueries({ queryKey: ["campaigns", clientId] });
      qc.invalidateQueries({ queryKey: ["client_campaigns_for_import_rpc", clientId] });
      setResult(res);
      toast.success(`${res.itemCount} item(ns) exportados para ${res.campaignName}`, {
        duration: 10_000,
        className: "pointer-events-auto",
        action: { label: "Abrir campanha", onClick: () => openDestination(res.campaignId) },
      });
    } catch (e) {
      const msg = e instanceof ExportToCampaignError ? e.message : `Não foi possível exportar: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      toast.error(msg, { duration: 12_000 });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !running) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => { if (running) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (running) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Exportar para campanha</DialogTitle>
          <DialogDescription>
            Copia os itens e o rateio deles para outra campanha do mesmo cliente. A campanha atual não é alterada. Orçamentos não vão junto.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ExportResultView result={result} sourceCodeById={sourceCodeById} storeNameById={storeNameById} />
        ) : (
          <div className="space-y-4">
            <section className="space-y-2">
              <p className="text-sm font-medium text-foreground">{exportSummaryWithRateio(selection, sourceRateio)}</p>
              {rateioError && <p className="text-xs text-destructive">Não foi possível ler o rateio da origem. Feche e abra de novo.</p>}
              {selection.autoKitIds.size > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden />
                  <p className="text-xs text-foreground">
                    A seleção tem peça(s) de kit. O kit inteiro vai junto, com todas as suas peças:{" "}
                    {selection.kits.filter((k) => selection.autoKitIds.has(k.id)).map((k) => k.name).join(", ")}.
                  </p>
                </div>
              )}
              {itemCount > 0 ? <ExportItemsPreview selection={selection} rateio={sourceRateio} /> : (
                <p className="text-sm text-muted-foreground">Nenhum item para exportar.</p>
              )}
            </section>

            <section className="space-y-3">
              <Label className="text-sm font-medium">Destino</Label>
              <RadioGroup value={destKind} onValueChange={(v) => setDestKind(v as "new" | "existing")} disabled={running} className="gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="new" id="export-dest-new" />
                    <Label htmlFor="export-dest-new" className="font-normal">Nova campanha</Label>
                  </div>
                  {destKind === "new" && (
                    <div className="pl-6 space-y-1">
                      <Label htmlFor="export-new-name" className="text-xs text-muted-foreground">Nome da campanha (obrigatório)</Label>
                      <Input id="export-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Natal 2026" disabled={running} autoFocus />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="existing" id="export-dest-existing" />
                    <Label htmlFor="export-dest-existing" className="font-normal">Campanha existente</Label>
                  </div>
                  {destKind === "existing" && (
                    <div className="pl-6 space-y-2">
                      <Select value={destId || undefined} onValueChange={setDestId} disabled={running}>
                        <SelectTrigger aria-label="Campanha de destino">
                          <SelectValue placeholder={loadingCampaigns ? "Carregando campanhas…" : "Escolha a campanha"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!loadingCampaigns && campaigns.length === 0 && (
                        <p className="text-xs text-muted-foreground">Este cliente não tem outra campanha.</p>
                      )}
                      {disabledWithQty.length > 0 && (
                        <div
                          className="flex items-start gap-1.5 text-xs text-foreground max-h-28 overflow-y-auto overscroll-contain rounded-md border border-warning/40 bg-warning/10 p-2"
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" aria-hidden />
                          <p>
                            {disabledWithQty.length} loja(s) com quantidade estão desativadas na campanha de destino:{" "}
                            {disabledWithQty.map((id) => storeNameById.get(id) ?? "Loja").sort((x, y) => x.localeCompare(y, "pt-BR")).join(", ")}
                          </p>
                        </div>
                      )}
                      {warnings.map((w) => (
                        <p key={w.index} className="flex items-start gap-1.5 text-xs text-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" aria-hidden />
                          {customFieldWarningText(w)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </RadioGroup>
            </section>

            {running && progress && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.label}{progress.total ? ` ${progress.done ?? 0}/${progress.total}` : ""}
              </p>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          {result ? (
            <>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={() => openDestination(result.campaignId)}>Abrir campanha</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={running}>Cancelar</Button>
              <Button onClick={handleExport} disabled={!canSubmit} className="whitespace-normal h-auto min-h-10 text-left">
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" />}
                Exportar {itemCount} item(ns) para {destLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
