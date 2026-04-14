import { useState, useMemo } from "react";
import { useLojaALojaTipos, useLojaALojaLojas, useToggleLojaAssignment, type LojaALojaTipo, type LojaALojaLoja } from "@/hooks/useLojaALoja";
import { useClientStores } from "@/hooks/useMultiClientData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Store } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const [openUFs, setOpenUFs] = useState<Record<string, boolean>>({});

  // Group stores by state
  const grouped = useMemo(() => {
    const groups: Record<string, typeof stores> = {};
    for (const s of stores) {
      const uf = s.state || "Sem UF";
      (groups[uf] ??= []).push(s);
    }
    // Sort UFs alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [stores]);

  // Build lookup: `storeId-tipoId-subdivisaoId` → ativo
  const assignmentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of lojas) {
      const key = `${l.store_id}-${l.tipo_id ?? ""}-${l.subdivisao_id ?? ""}`;
      map.set(key, l.ativo ?? false);
    }
    return map;
  }, [lojas]);

  const isActive = (storeId: string, tipoId: string, subId: string | null) =>
    assignmentMap.get(`${storeId}-${tipoId}-${subId ?? ""}`) ?? false;

  // Check if ANY sub of a tipo is active for a store
  const hasAnySub = (storeId: string, tipo: LojaALojaTipo) =>
    (tipo.subdivisoes ?? []).some((s) => isActive(storeId, tipo.id, s.id));

  const handleToggle = (storeId: string, tipoId: string, subId: string | null, newAtivo: boolean) => {
    if (!isAdmin) return;
    toggle.mutate({ campaign_id: campaignId, store_id: storeId, tipo_id: tipoId, subdivisao_id: subId, ativo: newAtivo });
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
        <p className="text-sm">Cadastre os tipos primeiro na aba "Cadastro de Tipos".</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Sticky legend */}
      <div className="sticky top-0 z-20 bg-background border-b px-4 py-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Legenda:</span>
        {tipos.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 text-xs">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {t.letra}
            </span>
            <span className="text-muted-foreground">{t.nome}</span>
          </span>
        ))}
      </div>

      {/* Store groups by UF */}
      <div className="divide-y">
        {grouped.map(([uf, ufStores]) => {
          const isOpen = openUFs[uf] !== false; // default open
          return (
            <Collapsible
              key={uf}
              open={isOpen}
              onOpenChange={(o) => setOpenUFs((p) => ({ ...p, [uf]: o }))}
            >
              <CollapsibleTrigger className="sticky top-[41px] z-10 w-full flex items-center gap-2 px-4 py-2 bg-muted/60 hover:bg-muted transition-colors cursor-pointer">
                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                <span className="font-semibold text-sm">{uf}</span>
                <span className="text-xs text-muted-foreground">({ufStores.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y">
                  {ufStores.map((store) => (
                    <div key={store.id} className="flex flex-col md:flex-row md:items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors">
                      {/* Store info */}
                      <div className="flex items-center gap-2 min-w-0 md:w-[340px] shrink-0">
                        {store.store_code && (
                          <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">{store.store_code}</span>
                        )}
                        <span className="text-sm font-medium truncate">{store.name}</span>
                        {store.city && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {store.city}</span>
                        )}
                      </div>
                      {/* Letra toggle buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        {tipos.map((tipo) => {
                          if (tipo.tem_subdivisao && (tipo.subdivisoes ?? []).length > 0) {
                            // Popover for subdivisoes
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
                                      const active = isActive(store.id, tipo.id, sub.id);
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
                          // Simple toggle
                          const active = isActive(store.id, tipo.id, null);
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
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
