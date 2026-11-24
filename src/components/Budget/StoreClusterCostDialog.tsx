import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import {
  commonItems, computeCampaignStoreCosts, customLabelName, distinctValues, groupStoreCosts,
  normItemName, type GroupDef,
} from "@/lib/storeClusterCost";
import { CUSTOM_FIELD_COUNT, loadCampaignCostInput, loadClientCampaignOptions, loadClientStores } from "@/lib/storeClusterCostData";
import { exportStoreClusterCostPDF } from "@/lib/exportStoreClusterCostPDF";
import { StoreClusterGroupEditor } from "./storeCluster/StoreClusterGroupEditor";
import { StoreClusterPresetBar } from "./storeCluster/StoreClusterPresetBar";
import { StoreClusterResults } from "./storeCluster/StoreClusterResults";
import { StoreClusterCommonItems } from "./storeCluster/StoreClusterCommonItems";

export interface StoreClusterCostDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  clientId: string;
  currencyCode: string;
}

const BASE_FIELDS = [
  { key: "store_model", label: "Modelo" },
  { key: "showcase_count", label: "Nº de vitrines" },
  { key: "delivery", label: "Logística" },
  { key: "state", label: "UF" },
  { key: "city", label: "Cidade" },
];
const stop = { onWheel: (e: React.WheelEvent) => e.stopPropagation(), onTouchMove: (e: React.TouchEvent) => e.stopPropagation() };

/** "Custo por grupo de lojas" — 100% leitura (escreve só modelos de grupos). */
export default function StoreClusterCostDialog({ open, onOpenChange, campaignId, clientId, currencyCode }: StoreClusterCostDialogProps) {
  const fmt = (v: number) => formatCurrencyByCode(v, currencyCode);
  const [includeOthers, setIncludeOthers] = useState(false);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [fieldKey, setFieldKey] = useState("store_model");
  const [groups, setGroups] = useState<GroupDef[]>([]);
  const [includeExtras, setIncludeExtras] = useState(true);
  const [topN, setTopN] = useState("20");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["scc-client", clientId],
    enabled: open,
    queryFn: async () => {
      const cols = Array.from({ length: CUSTOM_FIELD_COUNT }, (_, i) => `custom_field_${i + 1}_label`).join(", ");
      const { data, error } = await supabase.from("clients").select(`name, ${cols}`).eq("id", clientId).single();
      if (error) throw error;
      return data as unknown as Record<string, string | null>;
    },
  });
  const { data: options = [], isFetched: optionsFetched } = useQuery({ queryKey: ["scc-campaigns", clientId], enabled: open, queryFn: () => loadClientCampaignOptions(clientId) });
  const { data: clientStores } = useQuery({ queryKey: ["scc-stores", clientId], enabled: open, queryFn: () => loadClientStores(clientId) });

  const current = options.find((o) => o.id === campaignId || o.latestId === campaignId);
  const selected = useMemo(() => {
    const ids = [current?.latestId ?? campaignId, ...(includeOthers ? extraIds : [])];
    return [...new Set(ids)];
  }, [current, campaignId, includeOthers, extraIds]);

  const { data: inputs, isLoading } = useQuery({
    queryKey: ["scc-inputs", selected.join(","), clientStores?.length],
    enabled: open && !!clientStores && optionsFetched,
    queryFn: async () => {
      const res = await Promise.all(selected.map((id) => {
        const o = options.find((x) => x.latestId === id);
        return loadCampaignCostInput(id, o?.latestName ?? "Campanha atual", clientStores!);
      }));
      return res.filter((x): x is NonNullable<typeof x> => !!x);
    },
  });

  const fields = useMemo(() => {
    const custom = [];
    for (let i = 1; i <= CUSTOM_FIELD_COUNT; i++) {
      const l = customLabelName(client?.[`custom_field_${i}_label`]);
      if (l) custom.push({ key: `custom_field_${i}`, label: l });
    }
    return [...BASE_FIELDS, ...custom];
  }, [client]);
  const fieldLabel = fields.find((f) => f.key === fieldKey)?.label ?? fieldKey;

  const results = useMemo(() => (inputs ?? []).map((i) => computeCampaignStoreCosts(i, includeExtras)), [inputs, includeExtras]);
  const allStores = useMemo(() => (inputs ?? []).flatMap((i) => i.stores), [inputs]);
  const values = useMemo(() => distinctValues(allStores, fieldKey), [allStores, fieldKey]);
  const costs = useMemo(() => results.flatMap((r) => r.stores), [results]);
  const grouped = useMemo(() => groupStoreCosts(costs, fieldKey, groups), [costs, fieldKey, groups]);
  const items = useMemo(() => commonItems(results, inputs ?? [], fieldKey, groups), [results, inputs, fieldKey, groups]);
  const filteredItems = useMemo(() => {
    const q = normItemName(search);
    const f = q ? items.filter((i) => normItemName(`${i.code ?? ""} ${i.name}`).includes(q)) : items;
    return topN === "all" ? f : f.slice(0, Number(topN));
  }, [items, search, topN]);
  const campaignNames = Object.fromEntries(results.map((r) => [r.campaignId, r.campaignName]));
  const zero = results.reduce((s, r) => s + r.zeroStores, 0);
  const noWinnerCurrent = inputs && !inputs.some((i) => i.campaignId === (current?.latestId ?? campaignId));

  const doExport = async () => {
    setExporting(true);
    try {
      await exportStoreClusterCostPDF({
        clientName: client?.name ?? "", fieldLabel, groupDefs: groups, results, groups: grouped.groups, all: grouped.all,
        items: filteredItems, topLabel: topN === "all" ? "todas" : `Top ${topN}`, fmt, includeExtras,
      });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>Custo por grupo de lojas</DialogTitle>
          <DialogDescription>Média de quanto se gasta por loja em cada grupo, a partir do orçamento da vencedora. Nada é alterado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5" {...stop}>
          <section className="space-y-2">
            <StoreClusterPresetBar clientId={clientId} fieldKey={fieldKey} groups={groups} onLoad={(p) => { setFieldKey(p.field_key); setGroups(p.groups); }} />
          </section>

          <section className="space-y-2">
            <p className="text-sm">Campanha: <b>{current?.latestName ?? "atual"}</b>{current?.winnerName && <span className="text-muted-foreground"> · vencedora {current.winnerName}</span>}</p>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeOthers} onCheckedChange={(c) => setIncludeOthers(c === true)} /> Incluir outras campanhas do cliente</label>
            {includeOthers && (
              <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1" {...stop}>
                {options.filter((o) => o.latestId !== (current?.latestId ?? campaignId)).map((o) => (
                  <label key={o.latestId} className={`flex items-start gap-2 text-xs py-1 ${o.winnerName ? "" : "opacity-50"}`}>
                    <Checkbox
                      disabled={!o.winnerName}
                      checked={extraIds.includes(o.latestId)}
                      onCheckedChange={(c) => setExtraIds((p) => (c === true ? [...p, o.latestId] : p.filter((x) => x !== o.latestId)))}
                    />
                    <span>
                      {o.name}
                      {o.latestName !== o.name && <span className="text-muted-foreground"> → versão usada: {o.latestName}</span>}
                      <span className="text-muted-foreground"> · {o.winnerName ? `vencedora ${o.winnerName}` : "sem vencedora"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={fieldKey} onValueChange={(v) => { setFieldKey(v); setGroups([]); }}>
                <SelectTrigger aria-label="Agrupar por"><SelectValue /></SelectTrigger>
                <SelectContent {...stop}>{fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm pt-2"><Switch checked={includeExtras} onCheckedChange={setIncludeExtras} /> Incluir frete/instalação/desconto</label>
            </div>
            <StoreClusterGroupEditor values={values} groups={groups} onChange={setGroups} />
          </section>

          {isLoading || !inputs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha selecionada tem fornecedor vencedor declarado.</p>
          ) : (
            <>
              {noWinnerCurrent && <p className="text-xs text-muted-foreground">A campanha atual não tem vencedora e ficou fora da análise.</p>}
              <section className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-semibold text-sm">Conciliação</p>
                {results.map((r) => (
                  <p key={r.campaignId}>
                    {results.length > 1 && <b>{r.campaignName} ({r.supplierName}): </b>}
                    Soma das lojas {fmt(r.sumStores)} × Total ao vivo da vencedora {fmt(r.officialTotal)} · diferença {fmt(r.difference)}
                  </p>
                ))}
                <p className="text-muted-foreground">Diferença = arredondamento de kits (o total oficial calcula os kits pelo total da campanha).</p>
                {zero > 0 && <p className="text-muted-foreground">{zero} loja(s) sem peças nesta campanha ficaram fora das médias.</p>}
              </section>
              <StoreClusterResults groups={grouped.groups} all={grouped.all} fmt={fmt} campaignNames={campaignNames} />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Peças mais comuns</h3>
                <StoreClusterCommonItems
                  items={filteredItems} groupNames={grouped.groups.map((g) => g.name)} fmt={fmt} multi={results.length > 1}
                  topN={topN} onTopN={setTopN} search={search} onSearch={setSearch}
                />
              </section>
              <div className="flex justify-end">
                <Button onClick={doExport} disabled={exporting} className="gap-1">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Exportar PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
