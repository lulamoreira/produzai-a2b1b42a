import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MinusCircle, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierChangeMarkerMutations } from "@/hooks/useSupplierChangeMarkers";
import {
  findRemovalCandidates,
  type RemovalCandidate,
  type ResolvedSupplierChange,
  type SupplierChangeKind,
} from "@/lib/supplierChangeMarkers";

export interface RemovedItemsSectionProps {
  campaignId: string;
  previousCampaignId: string;
  previousCampaignName: string;
  current: { kind: SupplierChangeKind; code: number | null }[];
  removedMarkers: ResolvedSupplierChange[];
}

/** Items of the version the supplier quoted that are gone now; lets the user flag them as removed. */
export function RemovedItemsSection({
  campaignId, previousCampaignId, previousCampaignName, current, removedMarkers,
}: RemovedItemsSectionProps) {
  const { saveRemoved, remove } = useSupplierChangeMarkerMutations(campaignId);

  const previousQuery = useQuery({
    queryKey: ["supplier_change_previous_items", previousCampaignId],
    staleTime: 60_000,
    queryFn: async (): Promise<RemovalCandidate[]> => {
      const [pieces, kits] = await Promise.all([
        supabasePaginate<{ code: number; name: string; kit_only: boolean | null }>((from, to) =>
          supabase.from("campaign_pieces").select("id, code, name, kit_only", { count: "exact" })
            .eq("campaign_id", previousCampaignId).eq("is_deleted", false).order("id").range(from, to)),
        supabasePaginate<{ code: number; name: string }>((from, to) =>
          supabase.from("campaign_kits").select("id, code, name", { count: "exact" })
            .eq("campaign_id", previousCampaignId).eq("is_deleted", false).order("id").range(from, to)),
      ]);
      return [
        ...pieces.map((p) => ({ kind: "piece" as const, code: p.code, name: p.name })),
        ...kits.map((k) => ({ kind: "kit" as const, code: k.code, name: k.name })),
      ];
    },
  });

  const candidates = useMemo(() => {
    const alreadyMarked = removedMarkers.map((m) => ({ kind: m.kind, code: m.code }));
    return findRemovalCandidates(previousQuery.data ?? [], [...current, ...alreadyMarked]);
  }, [previousQuery.data, current, removedMarkers]);

  const markRemoved = async (c: RemovalCandidate) => {
    try {
      await saveRemoved.mutateAsync({ campaignId, kind: c.kind, code: c.code, name: c.name, note: "" });
      toast.success(`#${c.code} marcado como removido.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar.");
    }
  };

  const busy = saveRemoved.isPending || remove.isPending;
  const label = (k: SupplierChangeKind) => (k === "kit" ? "Kit" : "Peça");

  return (
    <section className="space-y-2" aria-labelledby="removed-items-title">
      <h4 id="removed-items-title" className="text-sm font-semibold">Itens que saíram desta versão</h4>
      <p className="text-xs text-muted-foreground">
        Estão em “{previousCampaignName}” e não estão aqui. Marque os que o fornecedor deve saber que saíram.
      </p>

      {removedMarkers.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm">
          <MinusCircle className="w-4 h-4 text-destructive shrink-0" aria-hidden />
          <span className="flex-1 min-w-0 break-words">{label(m.kind)} #{m.code} — {m.name}</span>
          <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => remove.mutate(m.id)} aria-label={`Desfazer remoção de #${m.code}`}>
            <Undo2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {previousQuery.isLoading && <Skeleton className="h-16 w-full" />}
      {previousQuery.isError && <p className="text-xs text-destructive">Não foi possível ler a versão anterior.</p>}
      {!previousQuery.isLoading && candidates.length === 0 && removedMarkers.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum item saiu em relação à versão anterior.</p>
      )}
      {candidates.map((c) => (
        <div key={`${c.kind}-${c.code}`} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
          <span className="flex-1 min-w-0 break-words text-muted-foreground">{label(c.kind)} #{c.code} — {c.name}</span>
          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={busy} onClick={() => markRemoved(c)}>
            {saveRemoved.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Marcar como removido"}
          </Button>
        </div>
      ))}
    </section>
  );
}
