import { useMemo } from "react";
import type { Occurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";
import type { OccurrenceMotive } from "@/hooks/useOccurrences";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp, Store, Puzzle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  occurrences: Occurrence[];
  stores: ClientStore[];
  pieces: CampaignPiece[];
  motives: OccurrenceMotive[];
}

const STATUS_CONFIG = {
  pending: { label: "Pendentes", color: "hsl(38, 92%, 55%)", icon: Clock, gradient: "gradient-accent", glow: "shadow-glow-accent" },
  resolved: { label: "Resolvidas", color: "hsl(152, 60%, 42%)", icon: CheckCircle2, gradient: "gradient-secondary", glow: "shadow-glow-secondary" },
  rejected: { label: "Rejeitadas", color: "hsl(0, 72%, 55%)", icon: XCircle, gradient: "bg-destructive", glow: "" },
};

const CHART_COLORS = [
  "hsl(250, 80%, 60%)",
  "hsl(170, 65%, 42%)",
  "hsl(38, 92%, 55%)",
  "hsl(210, 80%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(280, 75%, 55%)",
  "hsl(152, 60%, 42%)",
  "hsl(25, 90%, 55%)",
];

const OccurrencesDashboard = ({ occurrences, stores, pieces, motives }: Props) => {
  const stats = useMemo(() => {
    const total = occurrences.length;
    const pending = occurrences.filter((o) => (o.status || "pending") === "pending").length;
    const resolved = occurrences.filter((o) => o.status === "resolved").length;
    const rejected = occurrences.filter((o) => o.status === "rejected").length;
    return { total, pending, resolved, rejected };
  }, [occurrences]);

  const statusData = useMemo(() => [
    { name: "Pendentes", value: stats.pending, color: STATUS_CONFIG.pending.color },
    { name: "Resolvidas", value: stats.resolved, color: STATUS_CONFIG.resolved.color },
    { name: "Rejeitadas", value: stats.rejected, color: STATUS_CONFIG.rejected.color },
  ].filter((d) => d.value > 0), [stats]);

  const motiveData = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((o) => {
      const motive = motives.find((m) => m.id === o.motive_id);
      const name = motive?.description || "Sem motivo";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [occurrences, motives]);

  const storeData = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((o) => {
      const store = stores.find((s) => s.id === o.store_id);
      const name = store?.nickname || store?.name || "—";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [occurrences, stores]);

  const pieceData = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((o) => {
      const piece = pieces.find((p) => p.id === o.piece_id);
      const name = piece?.name || "—";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [occurrences, pieces]);

  if (occurrences.length === 0) return null;

  const resolutionRate = stats.total > 0 ? Math.round(((stats.resolved + stats.rejected) / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden relative">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-[11px] text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-warning/20 bg-gradient-to-br from-warning/10 to-warning/5 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-[11px] text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card className="border-success/20 bg-gradient-to-br from-success/10 to-success/5 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center shadow-glow-secondary flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.resolved}</p>
                <p className="text-[11px] text-muted-foreground">Resolvidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolution rate */}
        <Card className="border-info/20 bg-gradient-to-br from-info/10 to-info/5 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{resolutionRate}%</p>
                <p className="text-[11px] text-muted-foreground">Tratadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Status pie chart */}
        {statusData.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full gradient-primary" />
                Por Status
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} strokeWidth={0}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value} ocorrência(s)`, ""]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Motives bar chart */}
        {motiveData.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full gradient-accent" />
                Por Motivo
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={motiveData} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value}`, "Ocorrências"]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                    {motiveData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Stores bar chart */}
        {storeData.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full gradient-secondary" />
                Por Loja
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={storeData} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value}`, "Ocorrências"]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                    {storeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pieces breakdown - if there are occurrences by piece */}
      {pieceData.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-primary" />
              Ocorrências por Peça
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(120, pieceData.length * 32)}>
              <BarChart data={pieceData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [`${value}`, "Ocorrências"]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {pieceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OccurrencesDashboard;
