import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Store, Layers, Package, Trophy, ChevronDown } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import {
  useLojaALojaTipos,
  useAllLojaALojaPecas,
  useLojaALojaLojas,
  type LojaALojaTipo,
  type LojaALojaLoja,
} from "@/hooks/useLojaALoja";
import { useClientStores } from "@/hooks/useMultiClientData";
import { useTableSort } from "@/hooks/useTableSort";
import SortableHeader from "./SortableHeader";

interface Props {
  campaignId: string;
  clientId: string;
}

const BRAND = "#5B7B5E";

/**
 * For a given tipo and store, determine if the store is "active" for that tipo.
 * - Vitrines (no subdivisão): active if explicit row with ativo=true exists
 * - Internos (tem_subdivisao): active if at least one subdivision is active.
 *   Default is TRUE when no row exists for a subdivision.
 */
function isStoreActiveForTipo(
  storeId: string,
  tipo: LojaALojaTipo,
  lojasMap: Map<string, boolean>,
): boolean {
  if (tipo.tem_subdivisao && tipo.subdivisoes && tipo.subdivisoes.length > 0) {
    // Interno: at least one sub active (default true if no row)
    return tipo.subdivisoes.some((sub) => {
      const key = `${storeId}-${tipo.id}-${sub.id}`;
      return lojasMap.has(key) ? lojasMap.get(key)! : true; // default true
    });
  }
  // Vitrine: explicit row with ativo=true required (default false)
  const key = `${storeId}-${tipo.id}-`;
  return lojasMap.has(key) ? lojasMap.get(key)! : false;
}

export default function LojaALojaDashboard({ campaignId, clientId }: Props) {
  const { data: tipos, isLoading: loadingTipos } = useLojaALojaTipos(campaignId);
  const { data: allPecas, isLoading: loadingPecas } = useAllLojaALojaPecas(campaignId);
  const { data: lojas, isLoading: loadingLojas } = useLojaALojaLojas(campaignId);
  const { data: stores, isLoading: loadingStores } = useClientStores(clientId);

  const isLoading = loadingTipos || loadingPecas || loadingLojas || loadingStores;

  // Build lookup: `storeId-tipoId-subdivisaoId` → ativo
  const lojasMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of lojas ?? []) {
      const key = `${l.store_id}-${l.tipo_id ?? ""}-${l.subdivisao_id ?? ""}`;
      map.set(key, l.ativo ?? false);
    }
    return map;
  }, [lojas]);

  const storeMap = useMemo(() => {
    const m = new Map<string, { name: string; state: string }>();
    (stores ?? []).forEach((s: any) => m.set(s.id, { name: s.name, state: s.state ?? "Sem UF" }));
    return m;
  }, [stores]);

  const allStoreIds = useMemo(() => (stores ?? []).map((s: any) => s.id as string), [stores]);

  /* Count unique stores active per tipo */
  const activeStoresPerTipo = useMemo(() => {
    if (!tipos?.length) return new Map<string, Set<string>>();
    const result = new Map<string, Set<string>>();
    for (const tipo of tipos) {
      const activeSet = new Set<string>();
      for (const storeId of allStoreIds) {
        if (isStoreActiveForTipo(storeId, tipo, lojasMap)) {
          activeSet.add(storeId);
        }
      }
      result.set(tipo.id, activeSet);
    }
    return result;
  }, [tipos, allStoreIds, lojasMap]);

  /* KPI values */
  const totalStoreCount = allStoreIds.length;

  // Lojas que têm pelo menos um tipo ativo
  const storesWithAnyTipo = useMemo(() => {
    const all = new Set<string>();
    activeStoresPerTipo.forEach((storeSet) => storeSet.forEach((sid) => all.add(sid)));
    return all.size;
  }, [activeStoresPerTipo]);

  const totalTipos = (tipos ?? []).length;
  const totalPecas = (allPecas ?? []).length;

  const topTipo = useMemo(() => {
    if (!tipos?.length) return "—";
    let maxId = "";
    let maxN = 0;
    activeStoresPerTipo.forEach((storeSet, tipoId) => {
      if (storeSet.size > maxN) { maxN = storeSet.size; maxId = tipoId; }
    });
    return tipos.find((t) => t.id === maxId)?.nome ?? "—";
  }, [tipos, activeStoresPerTipo]);

  /* Chart: por tipo */
  const tipoChartData = useMemo(() => {
    if (!tipos?.length) return [];
    const maxVal = Math.max(1, ...Array.from(activeStoresPerTipo.values()).map((s) => s.size));
    return tipos.map((t) => {
      const count = activeStoresPerTipo.get(t.id)?.size ?? 0;
      return { letra: t.letra, nome: t.nome, count, pct: (count / maxVal) * 100 };
    });
  }, [tipos, activeStoresPerTipo]);

  /* Chart: por estado */
  const ufChartData = useMemo(() => {
    const storesWithAny = new Set<string>();
    activeStoresPerTipo.forEach((storeSet) => storeSet.forEach((sid) => storesWithAny.add(sid)));
    const ufCounts = new Map<string, number>();
    storesWithAny.forEach((sid) => {
      const uf = storeMap.get(sid)?.state ?? "Sem UF";
      ufCounts.set(uf, (ufCounts.get(uf) ?? 0) + 1);
    });
    const arr = Array.from(ufCounts.entries()).map(([uf, count]) => ({ uf, count }));
    arr.sort((a, b) => b.count - a.count);
    const maxVal = Math.max(1, ...arr.map((a) => a.count));
    return arr.map((a) => ({ ...a, pct: (a.count / maxVal) * 100 }));
  }, [activeStoresPerTipo, storeMap]);

  /* Table: cobertura */
  const coberturaData = useMemo(() => {
    if (!tipos?.length) return [];
    return tipos.map((t) => {
      const ativas = activeStoresPerTipo.get(t.id)?.size ?? 0;
      const cob = totalStoreCount > 0 ? (ativas / totalStoreCount) * 100 : 0;
      let pecasCount: number;
      if (t.tem_subdivisao && t.subdivisoes?.length) {
        const subIds = new Set(t.subdivisoes.map((s) => s.id));
        pecasCount = (allPecas ?? []).filter((p) => p.subdivisao_id && subIds.has(p.subdivisao_id)).length;
      } else {
        pecasCount = (allPecas ?? []).filter((p) => p.tipo_id === t.id).length;
      }
      return { letra: t.letra, nome: t.nome, id: t.id, ativas, cobertura: cob, pecas: pecasCount };
    });
  }, [tipos, activeStoresPerTipo, totalStoreCount, allPecas]);

  const { sortedItems: sortedCobertura, sortField: cobSortField, sortDir: cobSortDir, handleSort: handleCobSort } =
    useTableSort(coberturaData);

  /* Pieces grouped */
  const pecasByTipo = useMemo(() => {
    if (!tipos?.length || !allPecas?.length) return [];
    return tipos.map((t) => {
      let tipoPecas: typeof allPecas;
      if (t.tem_subdivisao && t.subdivisoes?.length) {
        const subIds = new Set(t.subdivisoes.map((s) => s.id));
        tipoPecas = (allPecas ?? []).filter((p) => p.subdivisao_id && subIds.has(p.subdivisao_id));
        const groups = t.subdivisoes.map((sub) => ({
          label: sub.nome,
          pecas: tipoPecas.filter((p) => p.subdivisao_id === sub.id),
        }));
        const ungrouped = tipoPecas.filter((p) => !p.subdivisao_id);
        if (ungrouped.length) groups.push({ label: "Sem subdivisão", pecas: ungrouped });
        return { tipo: t, groups, total: tipoPecas.length };
      }
      tipoPecas = (allPecas ?? []).filter((p) => p.tipo_id === t.id);
      return { tipo: t, groups: [{ label: null as string | null, pecas: tipoPecas }], total: tipoPecas.length };
    });
  }, [tipos, allPecas]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Store} label="Lojas cadastradas" value={totalStoreCount} />
        <KpiCard icon={Layers} label="Tipos ativos" value={totalTipos} />
        <KpiCard icon={Package} label="Peças cadastradas" value={totalPecas} />
        <KpiCard icon={Trophy} label="Tipo mais utilizado" value={topTipo} />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Dist. por Tipo */}
        <CollapsibleCard title="Distribuição por Tipo">
          <div className="space-y-2">
            {tipoChartData.map((d) => (
              <div key={d.letra} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND }}>{d.letra}</span>
                <span className="w-24 text-sm truncate text-muted-foreground">{d.nome}</span>
                <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: BRAND }} />
                </div>
                <span className="text-sm font-medium w-8 text-right">{d.count}</span>
              </div>
            ))}
            {tipoChartData.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p>}
          </div>
        </CollapsibleCard>

        {/* Dist. por Estado */}
        <CollapsibleCard title="Distribuição por Estado">
          <div className="space-y-2">
            {ufChartData.map((d) => (
              <div key={d.uf} className="flex items-center gap-2">
                <span className="w-10 text-sm font-medium text-muted-foreground">{d.uf}</span>
                <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: BRAND }} />
                </div>
                <span className="text-sm font-medium w-8 text-right">{d.count}</span>
              </div>
            ))}
            {ufChartData.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma loja atribuída</p>}
          </div>
        </CollapsibleCard>
      </div>

      {/* Tipos x Lojas Table */}
      <CollapsibleCard title="Tipos × Lojas">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Letra" field="letra" sortField={cobSortField} sortDir={cobSortDir} onSort={handleCobSort} className="w-12" />
                <SortableHeader label="Nome" field="nome" sortField={cobSortField} sortDir={cobSortDir} onSort={handleCobSort} />
                <SortableHeader label="Lojas Ativas" field="ativas" sortField={cobSortField} sortDir={cobSortDir} onSort={handleCobSort} align="right" />
                <SortableHeader label="Cobertura" field="cobertura" sortField={cobSortField} sortDir={cobSortDir} onSort={handleCobSort} align="right" />
                <SortableHeader label="Peças" field="pecas" sortField={cobSortField} sortDir={cobSortDir} onSort={handleCobSort} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCobertura.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: BRAND }}>{row.letra}</span>
                  </TableCell>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  <TableCell className="text-right">{row.ativas}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-semibold ${row.cobertura >= 80 ? "text-green-600" : row.cobertura >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {row.cobertura.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{row.pecas}</TableCell>
                </TableRow>
              ))}
              {sortedCobertura.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleCard>

      {/* Peças por Tipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Peças por Tipo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pecasByTipo.map(({ tipo, groups, total }) => (
            <div key={tipo.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: BRAND }}>{tipo.letra}</span>
                <span className="text-sm font-medium">{tipo.nome}</span>
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{total}</span>
              </div>
              {groups.map((g, gi) => (
                <div key={gi} className="ml-8 mb-2">
                  {g.label && <p className="text-xs text-muted-foreground mb-1">{g.label}</p>}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {g.pecas.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhuma peça</span>}
                    {g.pecas.map((p) => (
                      <PieceThumbnail key={p.id} imageUrl={p.image_url} name={p.nome} size="md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {pecasByTipo.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}20` }}>
          <Icon className="w-5 h-5" style={{ color: BRAND }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold truncate">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}
