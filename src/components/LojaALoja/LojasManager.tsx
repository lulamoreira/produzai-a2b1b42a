import { useState, useMemo } from "react";
import { useLojaALojaTipos, useLojaALojaLojas, useToggleLojaAssignment, type LojaALojaTipo } from "@/hooks/useLojaALoja";
import { useClientStores } from "@/hooks/useMultiClientData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Store, Copy, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTableSort } from "@/hooks/useTableSort";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

export default function LojasManager({ campaignId, clientId, isAdmin }: Props) {
  const { data: tipos = [], isLoading: loadingTipos } = useLojaALojaTipos(campaignId);
  const { data: lojas = [], isLoading: loadingLojas } = useLojaALojaLojas(campaignId);
  const { data: stores = [], isLoading: loadingStores } = useClientStores(clientId);
  const toggle = useToggleLojaAssignment();
  const qc = useQueryClient();

  // Search state
  const [search, setSearch] = useState("");

  // Copy dialog state
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [copying, setCopying] = useState(false);

  // Split tipos
  const vitrinesTipos = useMemo(() => tipos.filter((t) => !t.tem_subdivisao), [tipos]);
  const internosTipos = useMemo(() => tipos.filter((t) => t.tem_subdivisao), [tipos]);

  // Sort stores by UF then name
  const sortedStores = useMemo(
    () => [...stores].sort((a, b) => {
      const ufA = a.state || "ZZZ";
      const ufB = b.state || "ZZZ";
      if (ufA !== ufB) return ufA.localeCompare(ufB);
      return (a.name || "").localeCompare(b.name || "");
    }),
    [stores],
  );

  // Filter stores by search
  const filteredStores = useMemo(() => {
    if (!search.trim()) return sortedStores;
    const q = search.trim().toLowerCase();
    return sortedStores.filter((s) =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.store_code || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q) ||
      (s.state || "").toLowerCase().includes(q)
    );
  }, [sortedStores, search]);

  // Click-to-sort over the filtered stores (3-state cycle)
  const {
    sortedItems: sortedFilteredStores,
    sortField: storeSortField,
    sortDir: storeSortDir,
    handleSort: handleStoreSort,
  } = useTableSort(filteredStores);

  const renderSortTh = (label: string, field: string, className?: string) => {
    const Icon = storeSortField !== field ? ArrowUpDown : storeSortDir === "asc" ? ArrowUp : ArrowDown;
    const active = storeSortField === field && storeSortDir != null;
    return (
      <th
        onClick={() => handleStoreSort(field)}
        className={cn(
          "h-9 px-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:bg-muted/70 transition-colors",
          className
        )}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <Icon className={cn("w-3 h-3", active ? "opacity-100 text-foreground" : "opacity-40")} />
        </span>
      </th>
    );
  };

  // Build lookup: `storeId-tipoId-subdivisaoId` → ativo
  const assignmentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of lojas) {
      const key = `${l.store_id}-${l.tipo_id ?? ""}-${l.subdivisao_id ?? ""}`;
      map.set(key, l.ativo ?? false);
    }
    return map;
  }, [lojas]);

  // For INTERNO tipos (tem_subdivisao), default is TRUE when no row exists
  const isActive = (storeId: string, tipoId: string, subId: string | null, isInterno: boolean) => {
    const key = `${storeId}-${tipoId}-${subId ?? ""}`;
    if (assignmentMap.has(key)) return assignmentMap.get(key)!;
    return isInterno; // default true for internos, false for vitrines
  };

  const hasAnySub = (storeId: string, tipo: LojaALojaTipo) =>
    (tipo.subdivisoes ?? []).some((s) => isActive(storeId, tipo.id, s.id, tipo.tem_subdivisao));

  // Bulk toggle all INTERNO tipos for a single store
  const [bulkBusy, setBulkBusy] = useState(false);
  const handleBulkToggleInternosForStore = async (storeId: string, ativo: boolean) => {
    if (!isAdmin || bulkBusy) return;
    setBulkBusy(true);
    try {
      const rows: { campaign_id: string; store_id: string; tipo_id: string; subdivisao_id: string | null; ativo: boolean }[] = [];
      for (const tipo of internosTipos) {
        if (tipo.subdivisoes && tipo.subdivisoes.length > 0) {
          for (const sub of tipo.subdivisoes) {
            rows.push({ campaign_id: campaignId, store_id: storeId, tipo_id: tipo.id, subdivisao_id: sub.id, ativo });
          }
        } else {
          rows.push({ campaign_id: campaignId, store_id: storeId, tipo_id: tipo.id, subdivisao_id: null, ativo });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from("loja_a_loja_lojas")
          .upsert(rows, { onConflict: "campaign_id,store_id,tipo_id,subdivisao_id", ignoreDuplicates: false });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["loja-a-loja-lojas", campaignId] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  // Check if all internos are active for a store
  const allInternosActive = (storeId: string) => {
    for (const tipo of internosTipos) {
      if (tipo.subdivisoes && tipo.subdivisoes.length > 0) {
        for (const sub of tipo.subdivisoes) {
          if (!isActive(storeId, tipo.id, sub.id, true)) return false;
        }
      } else {
        if (!isActive(storeId, tipo.id, null, true)) return false;
      }
    }
    return true;
  };

  const handleToggle = (storeId: string, tipoId: string, subId: string | null, newAtivo: boolean) => {
    if (!isAdmin) return;
    toggle.mutate({ campaign_id: campaignId, store_id: storeId, tipo_id: tipoId, subdivisao_id: subId, ativo: newAtivo });
  };

  // Copy from previous campaign
  const handleOpenCopy = async () => {
    setShowCopyDialog(true);
    setLoadingCampaigns(true);
    setSelectedCampaignId(null);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, created_at")
        .eq("client_id", clientId)
        .neq("id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns(data ?? []);
    } catch (err: any) {
      toast.error("Erro ao buscar campanhas: " + err.message);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleConfirmCopy = async () => {
    if (!selectedCampaignId) return;
    setCopying(true);
    try {
      // Fetch source assignments, source tipos (with subdivisoes) in parallel
      const [assignRes, srcTiposRes, srcSubsRes] = await Promise.all([
        supabase.from("loja_a_loja_lojas").select("*").eq("campaign_id", selectedCampaignId),
        supabase.from("loja_a_loja_tipos").select("*").eq("campaign_id", selectedCampaignId),
        supabase.from("loja_a_loja_subdivisoes").select("*"),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (srcTiposRes.error) throw srcTiposRes.error;

      const sourceAssignments = assignRes.data ?? [];
      const srcTipos = srcTiposRes.data ?? [];
      const allSubs = srcSubsRes.data ?? [];

      // Build source tipo id → letra map
      const srcTipoMap = new Map(srcTipos.map((t) => [t.id, t]));

      // Build source sub id → { nome, tipo_id } map
      const srcSubMap = new Map(allSubs.filter((s) => srcTipos.some((t) => t.id === s.tipo_id)).map((s) => [s.id, s]));

      // Build dest tipo letra → tipo map
      const destTipoByLetra = new Map(tipos.map((t) => [t.letra, t]));

      const storeIds = new Set(stores.map((s) => s.id));
      const rows: { campaign_id: string; store_id: string; tipo_id: string; subdivisao_id: string | null; ativo: boolean }[] = [];

      for (const a of sourceAssignments) {
        if (!storeIds.has(a.store_id) || !a.tipo_id) continue;

        const srcTipo = srcTipoMap.get(a.tipo_id);
        if (!srcTipo) continue;

        const destTipo = destTipoByLetra.get(srcTipo.letra);
        if (!destTipo) continue;

        let destSubId: string | null = null;
        if (a.subdivisao_id) {
          const srcSub = srcSubMap.get(a.subdivisao_id);
          if (!srcSub) continue;
          const destSub = (destTipo.subdivisoes ?? []).find((ds) => ds.nome === srcSub.nome);
          if (!destSub) continue;
          destSubId = destSub.id;
        }

        rows.push({
          campaign_id: campaignId,
          store_id: a.store_id,
          tipo_id: destTipo.id,
          subdivisao_id: destSubId,
          ativo: a.ativo ?? false,
        });
      }

      if (rows.length === 0) {
        toast.info("Nenhuma atribuição compatível encontrada na campanha selecionada.");
        setCopying(false);
        return;
      }

      const { error: upsertErr } = await supabase
        .from("loja_a_loja_lojas")
        .upsert(rows, { onConflict: "campaign_id,store_id,tipo_id,subdivisao_id", ignoreDuplicates: false });
      if (upsertErr) throw upsertErr;

      qc.invalidateQueries({ queryKey: ["loja-a-loja-lojas", campaignId] });
      toast.success(`${rows.length} atribuições copiadas com sucesso!`);
      setShowCopyDialog(false);
    } catch (err: any) {
      toast.error("Erro ao copiar: " + err.message);
    } finally {
      setCopying(false);
    }
  };

  const isLoading = loadingTipos || loadingLojas || loadingStores;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (tipos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Store className="h-10 w-10" />
        <p className="text-sm">Cadastre os tipos primeiro na aba "Tipos de Lojas".</p>
      </div>
    );
  }

  const renderLetraCell = (store: { id: string }, tipo: LojaALojaTipo) => {
    if (tipo.tem_subdivisao && (tipo.subdivisoes ?? []).length > 0) {
      const anyActive = hasAnySub(store.id, tipo);
      return (
        <Popover key={tipo.id}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold border transition-colors",
                anyActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {tipo.letra}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <p className="text-xs font-semibold mb-1.5">{tipo.nome}</p>
            <div className="space-y-1">
              {(tipo.subdivisoes ?? []).map((sub) => {
                const active = isActive(store.id, tipo.id, sub.id, tipo.tem_subdivisao);
                return (
                  <label key={sub.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={active}
                      disabled={!isAdmin}
                      onCheckedChange={(checked) => handleToggle(store.id, tipo.id, sub.id, !!checked)}
                    />
                    {sub.nome}
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    const active = isActive(store.id, tipo.id, null, tipo.tem_subdivisao);
    return (
      <button
        key={tipo.id}
        disabled={!isAdmin}
        onClick={() => handleToggle(store.id, tipo.id, null, !active)}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold border transition-colors",
          active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary/50",
          !isAdmin && "opacity-50 cursor-not-allowed"
        )}
      >
        {tipo.letra}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      {/* Top actions */}
      <div className="flex items-center gap-2 px-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código, cidade..."
            className="h-8 text-xs pl-8"
          />
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 shrink-0" onClick={handleOpenCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copiar da campanha anterior
          </Button>
        )}
      </div>

      {/* Table container */}
      <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            {/* Column group header row */}
            <tr className="border-b border-border">
              <th colSpan={4} className="h-8 px-3 text-left text-xs font-medium text-muted-foreground" />
              {vitrinesTipos.length > 0 && (
                <th colSpan={vitrinesTipos.length} className="h-8 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border">
                  Vitrines
                </th>
              )}
              {internosTipos.length > 0 && (
                <th colSpan={internosTipos.length + (isAdmin ? 1 : 0)} className="h-8 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border">
                  Internos
                </th>
              )}
            </tr>
            {/* Individual letra headers */}
            <tr className="border-b border-border">
              {renderSortTh("Código", "store_code", "w-[80px]")}
              {renderSortTh("Loja", "name", "min-w-[200px]")}
              {renderSortTh("Cidade", "city", "min-w-[100px]")}
              {renderSortTh("UF", "state", "w-[60px]")}
              {vitrinesTipos.map((t) => (
                <th key={t.id} className="h-9 px-1 text-center text-xs font-bold w-10 border-l border-border" title={t.nome}>
                  {t.letra}
                </th>
              ))}
              {internosTipos.map((t, i) => (
                <th key={t.id} className={cn("h-9 px-1 text-center text-xs font-bold w-10", i === 0 && "border-l border-border")} title={t.nome}>
                  {t.letra}
                </th>
              ))}
              {isAdmin && internosTipos.length > 0 && (
                <th className="h-9 px-1 text-center text-[9px] font-medium text-muted-foreground w-8" title="Todos internos">
                  ✓
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedFilteredStores.map((store, idx) => (
              <tr key={store.id} className={cn("border-b border-border transition-colors hover:bg-muted/30", idx % 2 === 0 && "bg-muted/10")}>
                <td className="px-3 py-1.5 text-xs font-mono font-semibold text-primary whitespace-nowrap">{store.store_code || "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="text-sm font-medium truncate max-w-[260px] text-foreground">{store.name}</div>
                  {(store.street || store.neighborhood) && (
                    <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                      {[store.street, store.number, store.neighborhood].filter(Boolean).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground truncate">{store.city || "—"}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{store.state || "—"}</td>
                {vitrinesTipos.map((tipo) => (
                  <td key={tipo.id} className="px-1 py-1.5 text-center border-l border-border">
                    {renderLetraCell(store, tipo)}
                  </td>
                ))}
                {internosTipos.map((tipo, i) => (
                  <td key={tipo.id} className={cn("px-1 py-1.5 text-center", i === 0 && "border-l border-border")}>
                    {renderLetraCell(store, tipo)}
                  </td>
                ))}
                {isAdmin && internosTipos.length > 0 && (
                  <td className="px-0.5 py-1.5 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center justify-center">
                          <Checkbox
                            checked={allInternosActive(store.id)}
                            disabled={bulkBusy}
                            onCheckedChange={(checked) => handleBulkToggleInternosForStore(store.id, !!checked)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {allInternosActive(store.id) ? "Desmarcar todos internos" : "Marcar todos internos"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Copy Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar da campanha anterior</DialogTitle>
          </DialogHeader>
          {loadingCampaigns ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha anterior encontrada.</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaignId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    selectedCampaignId === c.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                  )}
                >
                  {c.name}
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCopyDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmCopy} disabled={!selectedCampaignId || copying}>
              {copying ? "Copiando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
