import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Layers, Package, Trophy } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import {
  useLojaALojaTipos,
  useAllLojaALojaPecas,
  useLojaALojaLojas,
  type LojaALojaTipo,
  type LojaALojaPeca,
  type LojaALojaLoja,
} from "@/hooks/useLojaALoja";
import { useClientStores } from "@/hooks/useMultiClientData";

interface Props {
  campaignId: string;
  clientId: string;
}

const BRAND = "#5B7B5E";

export default function LojaALojaDashboard({ campaignId, clientId }: Props) {
  const { data: tipos, isLoading: loadingTipos } = useLojaALojaTipos(campaignId);
  const { data: allPecas, isLoading: loadingPecas } = useAllLojaALojaPecas(campaignId);
  const { data: lojas, isLoading: loadingLojas } = useLojaALojaLojas(campaignId);
  const { data: stores, isLoading: loadingStores } = useClientStores(clientId);

  const isLoading = loadingTipos || loadingPecas || loadingLojas || loadingStores;

  const activeLojas = useMemo(() => (lojas ?? []).filter((l) => l.ativo), [lojas]);

  const storeMap = useMemo(() => {
    const m = new Map<string, { name: string; state: string }>();
    (stores ?? []).forEach((s: any) => m.set(s.id, { name: s.name, state: s.state ?? "Sem UF" }));
    return m;
  }, [stores]);

  /* KPI values */
  const totalActiveStores = useMemo(() => new Set(activeLojas.map((l) => l.store_id)).size, [activeLojas]);
  const totalTipos = (tipos ?? []).length;
  const totalPecas = (allPecas ?? []).length;
  const topTipo = useMemo(() => {
    if (!tipos?.length || !activeLojas.length) return "—";
    const counts = new Map<string, number>();
    activeLojas.forEach((l) => {
      if (l.tipo_id) counts.set(l.tipo_id, (counts.get(l.tipo_id) ?? 0) + 1);
    });
    let maxId = "";
    let maxN = 0;
    counts.forEach((n, id) => { if (n > maxN) { maxN = n; maxId = id; } });
    return tipos.find((t) => t.id === maxId)?.nome ?? "—";
  }, [tipos, activeLojas]);

  /* Chart: por tipo */
  const tipoChartData = useMemo(() => {
    if (!tipos?.length) return [];
    const counts = new Map<string, number>();
    activeLojas.forEach((l) => {
      if (l.tipo_id) counts.set(l.tipo_id, (counts.get(l.tipo_id) ?? 0) + 1);
    });
    const maxVal = Math.max(1, ...Array.from(counts.values()));
    return tipos.map((t) => ({ letra: t.letra, nome: t.nome, count: counts.get(t.id) ?? 0, pct: ((counts.get(t.id) ?? 0) / maxVal) * 100 }));
  }, [tipos, activeLojas]);

  /* Chart: por estado */
  const ufChartData = useMemo(() => {
    const activeStoreIds = new Set(activeLojas.map((l) => l.store_id));
    const ufCounts = new Map<string, number>();
    activeStoreIds.forEach((sid) => {
      const uf = storeMap.get(sid)?.state ?? "Sem UF";
      ufCounts.set(uf, (ufCounts.get(uf) ?? 0) + 1);
    });
    const arr = Array.from(ufCounts.entries()).map(([uf, count]) => ({ uf, count }));
    arr.sort((a, b) => b.count - a.count);
    const maxVal = Math.max(1, ...arr.map((a) => a.count));
    return arr.map((a) => ({ ...a, pct: (a.count / maxVal) * 100 }));
  }, [activeLojas, storeMap]);

  /* Table: cobertura */
  const totalStoreCount = (stores ?? []).length;
  const coberturaData = useMemo(() => {
    if (!tipos?.length) return [];
    return tipos.map((t) => {
      const ativas = new Set(activeLojas.filter((l) => l.tipo_id === t.id).map((l) => l.store_id)).size;
      const cob = totalStoreCount > 0 ? (ativas / totalStoreCount) * 100 : 0;
      const pecasCount = (allPecas ?? []).filter((p) => p.tipo_id === t.id).length;
      return { letra: t.letra, nome: t.nome, id: t.id, ativas, cobertura: cob, pecas: pecasCount };
    });
  }, [tipos, activeLojas, totalStoreCount, allPecas]);

  /* Pieces grouped */
  const pecasByTipo = useMemo(() => {
    if (!tipos?.length || !allPecas?.length) return [];
    return tipos.map((t) => {
      const tipoPecas = (allPecas ?? []).filter((p) => p.tipo_id === t.id);
      if (t.tem_subdivisao && t.subdivisoes?.length) {
        const groups = t.subdivisoes.map((sub) => ({
          label: sub.nome,
          pecas: tipoPecas.filter((p) => p.subdivisao_id === sub.id),
        }));
        const ungrouped = tipoPecas.filter((p) => !p.subdivisao_id);
        if (ungrouped.length) groups.push({ label: "Sem subdivisão", pecas: ungrouped });
        return { tipo: t, groups, total: tipoPecas.length };
      }
      return { tipo: t, groups: [{ label: null as string | null, pecas: tipoPecas }], total: tipoPecas.length };
    });
  }, [tipos, allPecas]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Store} label="Lojas cadastradas" value={totalActiveStores} />
        <KpiCard icon={Layers} label="Tipos ativos" value={totalTipos} />
        <KpiCard icon={Package} label="Peças cadastradas" value={totalPecas} />
        <KpiCard icon={Trophy} label="Tipo mais utilizado" value={topTipo} />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Dist. por Tipo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        {/* Dist. por Estado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>

      {/* Tipos x Lojas Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipos × Lojas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Letra</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Total Lojas</TableHead>
                  <TableHead className="text-right">Ativas</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coberturaData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: BRAND }}>{row.letra}</span>
                    </TableCell>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    <TableCell className="text-right">{totalStoreCount}</TableCell>
                    <TableCell className="text-right">{row.ativas}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${row.cobertura >= 80 ? "text-green-600" : row.cobertura >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {row.cobertura.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{row.pecas}</TableCell>
                  </TableRow>
                ))}
                {coberturaData.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
