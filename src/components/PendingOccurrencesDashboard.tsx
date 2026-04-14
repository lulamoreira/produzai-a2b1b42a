import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText, ArrowUpDown } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { exportPendingExcel, exportPendingPDF, type PendingOccurrenceData } from "@/lib/exportPendingOccurrences";
import type { Occurrence, OccurrenceMotive, OccurrenceStatus } from "@/hooks/useOccurrences";
import { useUserRole } from "@/hooks/useUserRole";
import { useCampaignKits, useCampaignKitPieces, useCampaignPieceLocations } from "@/hooks/useMultiClientData";
import { useCampaignSchedules } from "@/hooks/useCampaignSchedules";
import { getDefaultStatusValue, isOccurrenceOverdue, formatDateBR } from "@/lib/occurrenceHelpers";
import { OccurrenceDetailSheet } from "./OccurrenceDetailSheet";
import PhotoLightbox from "./PhotoLightbox";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName?: string;
  clientName?: string;
  agencyName?: string;
  agencyId?: string;
  clientId?: string;
  stores: { id: string; name: string; city: string | null; state: string | null; nickname?: string | null; store_code?: string | null }[];
  pieces: CampaignPiece[];
  motives: OccurrenceMotive[];
  statuses: OccurrenceStatus[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critica: "#dc2626", alta: "#f97316", media: "#eab308", baixa: "#22c55e",
};
const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

function daysOpenSince(created: string | null): number | null {
  if (!created) return null;
  const d = new Date(created);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a); const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

type SortKey = "store" | "reporter" | "created" | "expected" | "daysToResolve" | "daysOpen" | "priority" | "motive" | "status";

export default function PendingOccurrencesDashboard({
  open, onOpenChange, campaignId, campaignName, clientName, agencyName,
  agencyId, clientId, stores, pieces, motives, statuses,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("expected");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedOcc, setSelectedOcc] = useState<Occurrence | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { isAdmin, isAdminOrMaster } = useUserRole();

  // Internal data fetching
  const { data: kits = [] } = useCampaignKits(campaignId);
  const { data: kitPieces = [] } = useCampaignKitPieces(campaignId);
  const { data: pieceLocations = [] } = useCampaignPieceLocations(campaignId);
  const { scheduleMap } = useCampaignSchedules(campaignId);

  const { data: allOccurrences = [] } = useQuery({
    queryKey: ["occurrences", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("occurrences").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Occurrence[];
    },
    enabled: !!campaignId && open,
  });

  const pending = useMemo(() => allOccurrences.filter((o) => o.status === "andamento"), [allOccurrences]);

  const occurrenceIds = useMemo(() => pending.map((o) => o.id), [pending]);
  const { data: allPhotos = [] } = useQuery({
    queryKey: ["pending_occurrence_photos", campaignId],
    queryFn: async () => {
      if (occurrenceIds.length === 0) return [];
      const { data, error } = await supabase.from("occurrence_photos").select("*").in("occurrence_id", occurrenceIds);
      if (error) throw error;
      return data as { id: string; occurrence_id: string; photo_url: string }[];
    },
    enabled: occurrenceIds.length > 0 && open,
  });

  const photosMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allPhotos.forEach((p) => {
      if (!map[p.occurrence_id]) map[p.occurrence_id] = [];
      map[p.occurrence_id].push(p.photo_url);
    });
    pending.forEach((occ) => {
      if (occ.photo_url && (!map[occ.id] || !map[occ.id].includes(occ.photo_url))) {
        if (!map[occ.id]) map[occ.id] = [];
        map[occ.id].unshift(occ.photo_url);
      }
    });
    return map;
  }, [allPhotos, pending]);

  const storeMap = useMemo(() => {
    const m: Record<string, (typeof stores)[0]> = {};
    stores.forEach((s) => { m[s.id] = s; });
    return m;
  }, [stores]);

  const motiveMap = useMemo(() => {
    const m: Record<string, string> = {};
    motives.forEach((mo) => { m[mo.id] = mo.description; });
    return m;
  }, [motives]);

  const overdue = useMemo(() => pending.filter((o) => isOccurrenceOverdue(o.expected_resolution_date, o.status)), [pending]);
  const avgDaysOpen = useMemo(() => {
    let sum = 0; let count = 0;
    pending.forEach((o) => { const d = daysOpenSince(o.created_at); if (d !== null) { sum += d; count++; } });
    return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  }, [pending]);

  // Charts data
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    pending.forEach((o) => { const k = o.status || "sem_status"; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: statuses.find((s) => s.value === key)?.label || key,
      value,
      color: statuses.find((s) => s.value === key)?.color || "#6B7280",
    }));
  }, [pending, statuses]);

  const priorityChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    pending.forEach((o) => { counts[o.priority] = (counts[o.priority] || 0) + 1; });
    return ["critica", "alta", "media", "baixa"].map((p) => ({
      name: PRIORITY_LABELS[p] || p,
      value: counts[p] || 0,
      fill: PRIORITY_COLORS[p] || "#6B7280",
    }));
  }, [pending]);

  const motiveChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    pending.forEach((o) => {
      if (o.motive_id) { const label = motiveMap[o.motive_id] || "Outro"; counts[label] = (counts[label] || 0) + 1; }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, value }));
  }, [pending, motiveMap]);

  // Sorting — overdue first by default
  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortAsc(!sortAsc); } else { setSortKey(key); setSortAsc(true); }
  };

  const sortedPending = useMemo(() => {
    const arr = [...pending];
    const dir = sortAsc ? 1 : -1;
    arr.sort((a, b) => {
      // Always partition overdue first
      const aOverdue = isOccurrenceOverdue(a.expected_resolution_date, a.status) ? 1 : 0;
      const bOverdue = isOccurrenceOverdue(b.expected_resolution_date, b.status) ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue; // overdue first

      let va: string | number = 0; let vb: string | number = 0;
      switch (sortKey) {
        case "store": va = storeMap[a.store_id || ""]?.name || ""; vb = storeMap[b.store_id || ""]?.name || ""; break;
        case "reporter": va = a.reporter_name || ""; vb = b.reporter_name || ""; break;
        case "created": va = a.created_at || ""; vb = b.created_at || ""; break;
        case "expected": va = a.expected_resolution_date || "zzz"; vb = b.expected_resolution_date || "zzz"; break;
        case "daysToResolve": va = daysBetween(a.created_at, a.expected_resolution_date) ?? 9999; vb = daysBetween(b.created_at, b.expected_resolution_date) ?? 9999; break;
        case "daysOpen": va = daysOpenSince(a.created_at) ?? 0; vb = daysOpenSince(b.created_at) ?? 0; break;
        case "priority": { const ord: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }; va = ord[a.priority] ?? 4; vb = ord[b.priority] ?? 4; break; }
        case "motive": va = motiveMap[a.motive_id || ""] || ""; vb = motiveMap[b.motive_id || ""] || ""; break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
      }
      if (typeof va === "string") return va.localeCompare(vb as string) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return arr;
  }, [pending, sortKey, sortAsc, storeMap, motiveMap]);

  // Detail sheet helpers
  const activeStatuses = useMemo(() => statuses.filter((s) => s.active), [statuses]);
  const defaultStatus = useMemo(() => getDefaultStatusValue(statuses), [statuses]);

  const firstPieceKitLabels = useMemo(() => {
    const labels = new Map<string, string>();
    kits.forEach((kit) => {
      const memberPieceIds = kitPieces.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
      const firstMemberPiece = pieces.find((p) => memberPieceIds.includes(p.id));
      if (firstMemberPiece) labels.set(firstMemberPiece.id, `KIT ${kit.code} - ${kit.name}`);
    });
    return labels;
  }, [kits, kitPieces, pieces]);

  const getStoreName = (id: string | null) => {
    if (!id) return "—";
    const s = storeMap[id];
    return s?.nickname || s?.name || "—";
  };
  const getStoreInfo = (id: string | null) => {
    if (!id) return { code: "—", state: "", city: "" };
    const s = storeMap[id];
    return { code: s?.store_code || "—", state: s?.state || "", city: s?.city || "" };
  };
  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motiveMap[id] || "—";
  };
  const getPieceName = (id: string | null) => {
    if (!id) return "—";
    const kitLabel = firstPieceKitLabels.get(id);
    if (kitLabel) return kitLabel;
    return pieces.find((p) => p.id === id)?.name || "—";
  };
  const getReporterLabel = (reporterType?: string) => {
    if (reporterType === "agency") return agencyName || "Agência";
    if (reporterType === "fornecedor") return "Fornecedor";
    if (reporterType === "cliente") return clientName || "Cliente";
    return null;
  };

  const exportData: PendingOccurrenceData = {
    campaignName: campaignName || "",
    clientName: clientName || "",
    agencyName: agencyName || "",
    occurrences: pending.map((o) => ({
      id: o.id, store_id: o.store_id, motive_id: o.motive_id, description: o.description,
      status: o.status, priority: o.priority, created_at: o.created_at,
      expected_resolution_date: o.expected_resolution_date,
      reporter_name: o.reporter_name, reporter_type: o.reporter_type,
    })),
    stores: stores.map((s) => ({ id: s.id, name: s.name, city: s.city, state: s.state })),
    motives: motives.filter((m) => m.active !== false).map((m) => ({ id: m.id, description: m.description })),
    statuses: statuses.map((s) => ({ value: s.value, label: s.label, color: s.color })),
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => handleSort(field)}>
      <span className="inline-flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3 opacity-40" /></span>
    </TableHead>
  );

  const fmtDate = (v: string | null) => formatDateBR(v);

  const handleRowClick = (occ: Occurrence) => {
    setSelectedOcc(occ);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] overflow-y-auto p-4 sm:p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg">Dashboard de Pendências</SheetTitle>
          </SheetHeader>

          {/* Export buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => exportPendingExcel(exportData)}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => exportPendingPDF(exportData)}>
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: "#8C6F4E" }}>{pending.length}</div>
              <div className="text-xs text-muted-foreground">Total Em Andamento</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-destructive">{overdue.length}</div>
              <div className="text-xs text-muted-foreground">Atrasadas</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: "#f97316" }}>{avgDaysOpen}</div>
              <div className="text-xs text-muted-foreground">Média dias aberto</div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="p-3">
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Por Estado</h4>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={9}>
                    {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-3">
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Top 5 Motivos</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={motiveChartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8C6F4E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Full table */}
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <SortHeader label="Loja" field="store" />
                  <SortHeader label="Aberta por" field="reporter" />
                  <SortHeader label="Abertura" field="created" />
                  <SortHeader label="Previsão" field="expected" />
                  <SortHeader label="Dias p/ Resolver" field="daysToResolve" />
                  <SortHeader label="Dias Aberto" field="daysOpen" />
                  <SortHeader label="Prioridade" field="priority" />
                  <SortHeader label="Motivo" field="motive" />
                  <SortHeader label="Status" field="status" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPending.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nenhuma ocorrência pendente</TableCell></TableRow>
                )}
                {sortedPending.map((occ) => {
                  const store = storeMap[occ.store_id || ""];
                  const dToResolve = daysBetween(occ.created_at, occ.expected_resolution_date);
                  const dOpen = daysOpenSince(occ.created_at);
                  const isOverdue = isOccurrenceOverdue(occ.expected_resolution_date, occ.status);
                  const statusInfo = statuses.find((s) => s.value === occ.status);
                  return (
                    <TableRow
                      key={occ.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${isOverdue ? "border-l-4 border-l-destructive bg-red-50 dark:bg-red-950/20" : ""}`}
                      onClick={() => handleRowClick(occ)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">{store?.name || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{occ.reporter_name || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(occ.created_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(occ.expected_resolution_date)}</TableCell>
                      <TableCell className="text-xs text-center">{dToResolve ?? "—"}</TableCell>
                      <TableCell className="text-xs text-center font-semibold">{dOpen ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: PRIORITY_COLORS[occ.priority] || "#6B7280" }}>
                          {PRIORITY_LABELS[occ.priority] || occ.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{motiveMap[occ.motive_id || ""] || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: statusInfo?.color || "#6B7280" }}>
                          {statusInfo?.label || occ.status || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>

      {/* OccurrenceDetailSheet */}
      <OccurrenceDetailSheet
        occ={selectedOcc}
        open={!!selectedOcc}
        onOpenChange={(o) => { if (!o) setSelectedOcc(null); }}
        campaignId={campaignId}
        stores={stores as any}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        pieceLocations={pieceLocations}
        canEdit={isAdminOrMaster}
        canDelete={isAdmin}
        canEditReporter={isAdminOrMaster}
        motives={motives}
        statuses={statuses}
        activeStatuses={activeStatuses}
        defaultStatus={defaultStatus}
        photosMap={photosMap}
        campaignName={campaignName || ""}
        agencyName={agencyName || ""}
        clientName={clientName || ""}
        getReporterLabel={getReporterLabel}
        firstPieceKitLabels={firstPieceKitLabels}
        onOpenLightbox={(photos, index) => { setLightboxPhotos(photos); setLightboxIndex(index); setLightboxOpen(true); }}
        agencyId={agencyId}
        clientId={clientId}
        getStoreName={getStoreName}
        getStoreInfo={getStoreInfo}
        getMotiveName={getMotiveName}
        getPieceName={getPieceName}
      />

      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
