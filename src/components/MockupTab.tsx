import { useState, useMemo } from "react";
import {
  useCampaignMockups,
  useInitializeMockups,
  useAddPieceToMockup,
  computeKitRolledUpStatus,
  type CampaignMockup,
  type MockupStatus,
} from "@/hooks/useMockups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  Plus,
  FileSpreadsheet,
  FileText,
  ImageOff,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import MockupReviewSheet from "@/components/MockupReviewSheet";

interface Props {
  campaignId: string;
  campaignName: string;
  pieces: any[];
  kits: any[];
  kitPieces: { kit_id: string; piece_id: string; quantity?: number }[];
}

type FilterKey = "all" | MockupStatus;

const STATUS_BADGE: Record<MockupStatus, { icon: string; cls: string }> = {
  approved: { icon: "✅", cls: "bg-green-600 text-white border-transparent" },
  rejected: { icon: "❌", cls: "bg-red-600 text-white border-transparent" },
  changes_requested: { icon: "✏️", cls: "bg-amber-600 text-white border-transparent" },
  pending: { icon: "⏳", cls: "bg-muted text-foreground border-transparent" },
};

export default function MockupTab({
  campaignId,
  campaignName,
  pieces,
  kits,
  kitPieces,
}: Props) {
  const { data: mockups = [], isLoading } = useCampaignMockups(campaignId);
  const initialize = useInitializeMockups();
  const addPiece = useAddPieceToMockup();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const piecesById = useMemo(() => {
    const m = new Map<string, any>();
    pieces.forEach((p) => m.set(p.id, p));
    return m;
  }, [pieces]);

  const kitsById = useMemo(() => {
    const m = new Map<string, any>();
    kits.forEach((k) => m.set(k.id, k));
    return m;
  }, [kits]);

  // Top-level mockups (parent_mockup_id null) for the grid
  const topLevel = useMemo(
    () => mockups.filter((m) => !m.parent_mockup_id),
    [mockups]
  );

  const counts = useMemo(() => {
    const c = { approved: 0, rejected: 0, changes_requested: 0, pending: 0 };
    topLevel.forEach((m) => {
      c[m.status as MockupStatus] += 1;
    });
    return c;
  }, [topLevel]);

  const reviewed = counts.approved + counts.rejected + counts.changes_requested;
  const total = topLevel.length;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === "all") return topLevel;
    return topLevel.filter((m) => m.status === filter);
  }, [topLevel, filter]);

  // Pieces eligible to add: not in mockup, not kit_only, not deleted
  const availablePieces = useMemo(() => {
    const inMockup = new Set(
      mockups.filter((m) => m.piece_id && !m.parent_mockup_id).map((m) => m.piece_id!)
    );
    return pieces.filter(
      (p) => !inMockup.has(p.id) && !p.kit_only
    );
  }, [pieces, mockups]);

  // Initialization preview count
  const initPreview = useMemo(() => {
    const piecesCount = pieces.filter((p) => p.is_mockup && !p.kit_only).length;
    const mockupPieceIds = new Set(pieces.filter((p) => p.is_mockup).map((p) => p.id));
    const kitsCount = kits.filter((k) =>
      kitPieces.some((kp) => kp.kit_id === k.id && mockupPieceIds.has(kp.piece_id))
    ).length;
    return piecesCount + kitsCount;
  }, [pieces, kits, kitPieces]);

  const openReview = (id: string) => {
    setReviewId(id);
    setReviewOpen(true);
  };

  const FilterChip = ({ k, label }: { k: FilterKey; label: string }) => (
    <button
      onClick={() => setFilter(k)}
      className={`min-h-[44px] px-4 rounded-full border text-sm font-medium whitespace-nowrap transition-colors ${
        filter === k
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-border text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background pb-3 -mx-4 px-4 border-b">
        <div className="flex items-start justify-between gap-3 flex-wrap pt-2">
          <div>
            <h2 className="text-xl font-semibold">Mockup</h2>
            <p className="text-sm text-muted-foreground">{campaignName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-1.5"
              onClick={() => toast.info("Em breve")}
            >
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-1.5"
              onClick={() => toast.info("Em breve")}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-sm">
              <span className="font-medium">{reviewed}</span> de{" "}
              <span className="font-medium">{total}</span> revisados ({pct}%)
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                {counts.approved} aprovadas
              </span>
              <span className="inline-flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                {counts.rejected} reprovadas
              </span>
              <span className="inline-flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                {counts.changes_requested} com alterações
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {counts.pending} pendentes
              </span>
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip k="all" label="Todas" />
            <FilterChip k="pending" label="Pendentes" />
            <FilterChip k="approved" label="Aprovadas" />
            <FilterChip k="changes_requested" label="Alterações" />
            <FilterChip k="rejected" label="Reprovadas" />
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && total === 0 && (
        <div className="py-8">
          <EmptyState
            icon={LayoutGrid}
            title="Nenhuma peça marcada como mockup nesta campanha."
            subtitle={
              initPreview > 0
                ? `Serão criados ${initPreview} mockups baseados nas peças marcadas como mockup e seus kits relacionados.`
                : "Marque peças como mockup no módulo de Peças para iniciar."
            }
          />
          {initPreview > 0 && (
            <div className="flex justify-center">
              <Button
                className="min-h-[48px]"
                disabled={initialize.isPending}
                onClick={() =>
                  initialize.mutate({
                    campaignId,
                    pieces: pieces.map((p) => ({
                      id: p.id,
                      is_mockup: p.is_mockup,
                      kit_only: p.kit_only,
                    })),
                    kits: kits.map((k) => ({ id: k.id })),
                    kitPieces: kitPieces.map((kp) => ({
                      kit_id: kp.kit_id,
                      piece_id: kp.piece_id,
                    })),
                  })
                }
              >
                Inicializar mockups
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add piece action */}
      {total > 0 && (
        <div>
          <Button
            variant="outline"
            className="min-h-[44px] gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" /> Adicionar peça ao mockup
          </Button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((m) => {
            const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
            const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
            const name = piece?.name || kit?.name || "—";
            const img = piece?.image_url || kit?.image_url || null;
            const badge = STATUS_BADGE[m.status as MockupStatus];
            const kitComponentCount = kit
              ? kitPieces.filter((kp) => kp.kit_id === kit.id).length
              : 0;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => openReview(m.id)}
                className="group relative rounded-lg overflow-hidden border bg-card text-left min-h-[200px] aspect-[4/5] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {img ? (
                  <img
                    src={img}
                    alt={name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageOff className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  <Badge className={`${badge.cls} text-base px-2 py-1`}>
                    {badge.icon}
                  </Badge>
                </div>

                {/* Kit indicator */}
                {kit && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="gap-1 text-[11px]">
                      <Layers className="w-3 h-3" /> Kit ({kitComponentCount})
                    </Badge>
                  </div>
                )}

                {/* Name overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                  <div className="text-white text-sm font-medium line-clamp-2">
                    {name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && total > 0 && (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma peça neste filtro."
          subtitle="Ajuste o filtro para ver mais resultados."
        />
      )}

      {/* Review sheet */}
      {reviewId && (
        <MockupReviewSheet
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v);
            if (!v) setReviewId(null);
          }}
          mockups={filtered}
          initialMockupId={reviewId}
          pieces={pieces}
          kits={kits}
          campaignId={campaignId}
        />
      )}

      {/* Add piece dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar peça ao mockup</DialogTitle>
          </DialogHeader>
          {availablePieces.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Todas as peças disponíveis já estão no mockup.
            </p>
          ) : (
            <div className="space-y-2">
              {availablePieces.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-2 rounded-md border hover:bg-accent text-left min-h-[56px]"
                  onClick={async () => {
                    await addPiece.mutateAsync({ campaignId, pieceId: p.id });
                    setAddOpen(false);
                  }}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <ImageOff className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.size || ""}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
