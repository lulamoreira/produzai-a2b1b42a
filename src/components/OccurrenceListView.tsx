import { useState, useMemo } from "react";
import { format } from "date-fns";
import type { Occurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import type { Schedule } from "@/types/schedule";
import { Lock, ChevronRight } from "lucide-react";
import { PRIORITY_OPTIONS } from "@/types/occurrence";
import { getStatusLabel, getStatusColor } from "@/lib/occurrenceHelpers";
import { OccurrenceDetailSheet } from "./OccurrenceDetailSheet";

interface OccurrenceListViewProps {
  occurrences: Occurrence[];
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  pieceLocations: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canEditReporter: boolean;
  motives: { id: string; description: string; active?: boolean }[];
  statuses: { id: string; label: string; value: string; color: string; active: boolean; is_default?: boolean }[];
  defaultStatus: string;
  photosMap: Record<string, string[]>;
  campaignName: string;
  agencyName: string;
  clientName: string;
  getReporterLabel: (t?: string) => string | null;
  firstPieceKitLabels: Map<string, string>;
  whatsappLinkTemplate?: string;
  whatsappContactTemplate?: string;
  onOpenLightbox: (photos: string[], index: number) => void;
  canLockCards?: boolean;
  scheduleMap: Record<string, Schedule>;
  agencyId?: string;
  clientId?: string;
}

export default function OccurrenceListView({
  occurrences, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit, canDelete, canEditReporter, motives, statuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, canLockCards, scheduleMap, agencyId, clientId,
}: OccurrenceListViewProps) {
  const [selectedOccId, setSelectedOccId] = useState<string | null>(null);
  const selectedOcc = useMemo(() => occurrences.find(o => o.id === selectedOccId), [occurrences, selectedOccId]);

  const getStoreName = (id: string | null) => {
    if (!id) return "—";
    const s = stores.find(s => s.id === id);
    return s?.nickname || s?.name || "—";
  };

  const getStoreInfo = (id: string | null) => {
    if (!id) return { code: "—", state: "", city: "" };
    const s = stores.find(s => s.id === id);
    return { code: s?.store_code || "—", state: s?.state || "", city: s?.city || "" };
  };

  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motives.find(m => m.id === id)?.description || "—";
  };

  const getPieceName = (id: string | null) => {
    if (!id) return "—";
    const kitLabel = firstPieceKitLabels.get(id);
    if (kitLabel) return kitLabel;
    return pieces.find(p => p.id === id)?.name || "—";
  };

  const getPriorityColor = (value: string) => PRIORITY_OPTIONS.find(p => p.value === value)?.color || "#6366f1";
  const getPriorityLabel = (value: string) => PRIORITY_OPTIONS.find(p => p.value === value)?.label || "Média";

  const activeStatuses = useMemo(() => statuses.filter(s => s.active), [statuses]);

  return (
    <>
      <div className="space-y-1.5">
        {occurrences.map(occ => {
          const priority = occ.priority || "media";
          const status = occ.status || defaultStatus;
          const storeInfo = getStoreInfo(occ.store_id);
          const motiveName = getMotiveName(occ.motive_id);
          const pieceName = occ.kit_id ? `Kit ${kits.find(k => k.id === occ.kit_id)?.name || ""}` : getPieceName(occ.piece_id);

          return (
            <div
              key={occ.id}
              onClick={() => setSelectedOccId(occ.id)}
              className="card-base p-3 cursor-pointer hover:bg-[var(--bg-page)] transition-colors duration-100"
              style={{ borderLeft: `4px solid ${getPriorityColor(priority)}` }}
            >
              {/* Row 1: Priority badge + Status badge + Store name */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${getPriorityColor(priority)}15`, color: getPriorityColor(priority), border: `1px solid ${getPriorityColor(priority)}40` }}
                >
                  ● {getPriorityLabel(priority)}
                </span>
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${getStatusColor(statuses, status)}15`, color: getStatusColor(statuses, status), border: `1px solid ${getStatusColor(statuses, status)}40` }}
                >
                  {getStatusLabel(statuses, status)}
                </span>
                <span className="text-sm font-semibold text-foreground">{getStoreName(occ.store_id)}</span>
                <span className="text-xs text-[var(--text-secondary)]">{storeInfo.code} · {storeInfo.state} · {storeInfo.city}</span>
                {(occ as any).locked && (
                  <Lock className="w-3 h-3 text-destructive" />
                )}
              </div>

              {/* Row 2: Motive + piece */}
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {motiveName}{pieceName !== "—" ? ` — ${pieceName}` : ""}
              </p>

              {/* Row 3: Dates + reporter */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Criado: {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  {occ.expected_resolution_date && ` · Res. prevista: ${format(new Date(occ.expected_resolution_date), "dd/MM/yyyy")}`}
                  {getReporterLabel(occ.reporter_type) && ` · ${getReporterLabel(occ.reporter_type)}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {occ.needs_reinstallation && (
                    <span className="badge-base badge-warning text-[10px] px-1.5 py-0">✔ Reinstalação</span>
                  )}
                  <span className="text-[11px] text-primary flex items-center gap-0.5">
                    Abrir detalhe <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <OccurrenceDetailSheet
        occ={selectedOcc || null}
        open={!!selectedOccId}
        onOpenChange={(open) => { if (!open) setSelectedOccId(null); }}
        campaignId={campaignId}
        stores={stores}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        pieceLocations={pieceLocations}
        canEdit={canEdit}
        canDelete={canDelete}
        canEditReporter={canEditReporter}
        motives={motives}
        statuses={statuses}
        activeStatuses={activeStatuses}
        defaultStatus={defaultStatus}
        photosMap={photosMap}
        campaignName={campaignName}
        agencyName={agencyName}
        clientName={clientName}
        getReporterLabel={getReporterLabel}
        firstPieceKitLabels={firstPieceKitLabels}
        whatsappLinkTemplate={whatsappLinkTemplate}
        whatsappContactTemplate={whatsappContactTemplate}
        onOpenLightbox={onOpenLightbox}
        canLockCards={canLockCards}
        agencyId={agencyId}
        clientId={clientId}
        getStoreName={(id) => {
          if (!id) return "—";
          const s = stores.find(s => s.id === id);
          return s?.nickname || s?.name || "—";
        }}
        getStoreInfo={getStoreInfo}
        getMotiveName={getMotiveName}
        getPieceName={getPieceName}
      />
    </>
  );
}

