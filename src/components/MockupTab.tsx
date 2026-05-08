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
  DialogDescription,
  DialogFooter,
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
  Search,
  X,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import MockupReviewSheet from "@/components/MockupReviewSheet";
import { exportMockupPDF } from "@/lib/exportMockupPDF";
import { exportMockupExcel } from "@/lib/exportMockupExcel";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  campaignId: string;
  campaignName: string;
  agencyName?: string;
  clientName?: string;
  pieces: any[];
  kits: any[];
  kitPieces: { kit_id: string; piece_id: string; quantity?: number }[];
}

type FilterKey = "all" | MockupStatus;

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Todas",
  pending: "Pendentes",
  approved: "Aprovadas",
  changes_requested: "Alterações",
  rejected: "Reprovadas",
};

const STATUS_BADGE: Record<MockupStatus, { icon: string; cls: string }> = {
  approved: { icon: "✅", cls: "bg-green-600 text-white border-transparent" },
  rejected: { icon: "❌", cls: "bg-red-600 text-white border-transparent" },
  changes_requested: { icon: "✏️", cls: "bg-amber-600 text-white border-transparent" },
  pending: { icon: "⏳", cls: "bg-muted text-foreground border-transparent" },
};

export default function MockupTab({
  campaignId,
  campaignName,
  agencyName = "",
  clientName = "",
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
  const [search, setSearch] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<MockupStatus | null>(null);
  const [resetClearAnnotations, setResetClearAnnotations] = useState(true);
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();

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

  // Top-level mockups (parent_mockup_id null) for the grid.
  // ORDER IS STABLE — based on the underlying piece/kit display_order so it does NOT
  // change when the user marks approved/rejected/changes_requested.
  const topLevel = useMemo(() => {
    const list = mockups.filter((m) => !m.parent_mockup_id);
    const orderOf = (m: CampaignMockup) => {
      const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
      const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
      const ord = piece?.display_order ?? kit?.display_order ?? 0;
      const name = (piece?.name || kit?.name || "").toLowerCase();
      return { ord, name };
    };
    return [...list].sort((a, b) => {
      const A = orderOf(a);
      const B = orderOf(b);
      if (A.ord !== B.ord) return A.ord - B.ord;
      if (A.name !== B.name) return A.name.localeCompare(B.name);
      return a.id.localeCompare(b.id);
    });
  }, [mockups, piecesById, kitsById]);

  // Components grouped by parent kit mockup id
  const componentsByParent = useMemo(() => {
    const map = new Map<string, CampaignMockup[]>();
    mockups.forEach((m) => {
      if (m.parent_mockup_id) {
        const arr = map.get(m.parent_mockup_id) || [];
        arr.push(m);
        map.set(m.parent_mockup_id, arr);
      }
    });
    return map;
  }, [mockups]);

  // Effective status (rolled-up for kits)
  const effectiveStatus = (m: CampaignMockup): MockupStatus => {
    if (m.kit_id) {
      const comps = componentsByParent.get(m.id) || [];
      if (comps.length > 0) return computeKitRolledUpStatus(comps);
    }
    return m.status;
  };

  const counts = useMemo(() => {
    const c = { approved: 0, rejected: 0, changes_requested: 0, pending: 0 };
    topLevel.forEach((m) => {
      c[effectiveStatus(m)] += 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, componentsByParent]);

  const reviewed = counts.approved + counts.rejected + counts.changes_requested;
  const total = topLevel.length;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = topLevel;
    if (filter !== "all") list = list.filter((m) => effectiveStatus(m) === filter);
    if (q) {
      list = list.filter((m) => {
        const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
        const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
        const name = (piece?.name || kit?.name || "").toLowerCase();
        return name.includes(q);
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, filter, componentsByParent, search, piecesById, kitsById]);

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

  // Build the export set: include kit components for any top-level kit in the chosen scope
  const buildExportMockups = (): CampaignMockup[] => {
    const scope = filter === "all" ? topLevel : filtered;
    const ids = new Set(scope.map((m) => m.id));
    const components = mockups.filter(
      (m) => m.parent_mockup_id && ids.has(m.parent_mockup_id)
    );
    return [...scope, ...components];
  };

  const handleExportPDF = async () => {
    const tId = toast.loading("Gerando PDF...");
    try {
      const exportSet = buildExportMockups();
      if (filter !== "all") {
        toast.message(`Exportando ${filtered.length} mockups (filtro: ${FILTER_LABEL[filter]})`);
      }
      const { blob, fileName } = await exportMockupPDF({
        campaignName,
        agencyName,
        clientName,
        mockups: exportSet,
        pieces,
        kits,
        kitPieces,
      });
      await saveBlobAs(blob, fileName, {
        mimeType: "application/pdf",
        description: "PDF",
        extension: ".pdf",
      });
      toast.success("PDF gerado", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF", { id: tId });
    }
  };

  const handleExportExcel = async () => {
    const tId = toast.loading("Gerando Excel...");
    try {
      const exportSet = buildExportMockups();
      if (filter !== "all") {
        toast.message(`Exportando ${filtered.length} mockups (filtro: ${FILTER_LABEL[filter]})`);
      }
      const { blob, fileName } = await exportMockupExcel({
        campaignName,
        mockups: exportSet,
        pieces,
        kits,
      });
      await saveBlobAs(blob, fileName, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        description: "Excel",
        extension: ".xlsx",
      });
      toast.success("Excel gerado", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar Excel", { id: tId });
    }
  };

  const handleResetAll = async () => {
    if (!resetTarget) return;
    setResetting(true);
    const tId = toast.loading("Zerando mockup...");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const updatePayload: any = {
        status: resetTarget,
        alt_name: null,
        alt_size: null,
        alt_specification: null,
        alt_installation: null,
        alt_name_active: false,
        alt_size_active: false,
        alt_specification_active: false,
        alt_installation_active: false,
        observations: null,
        reviewed_by: userData?.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      };
      if (resetClearAnnotations) {
        updatePayload.annotated_image_url = null;
      }
      const { error } = await supabase
        .from("campaign_mockups")
        .update(updatePayload)
        .eq("campaign_id", campaignId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["campaign_mockups", campaignId] });
      toast.success("Mockup zerado com sucesso", { id: tId });
      setResetOpen(false);
      setResetTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao zerar mockup", { id: tId });
    } finally {
      setResetting(false);
    }
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
              onClick={handleExportPDF}
            >
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-1.5"
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            {total > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  setResetTarget(null);
                  setResetOpen(true);
                }}
              >
                <RotateCcw className="w-4 h-4" /> Zerar
              </Button>
            )}
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

        {total > 0 && (
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar peça ou kit pelo nome..."
              className="pl-9 pr-9 h-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
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
            // Kit image fallback: kit.image_url -> first component piece image
            let img: string | null = piece?.image_url || kit?.image_url || null;
            if (!img && kit) {
              const comps = componentsByParent.get(m.id) || [];
              for (const c of comps) {
                const cp = c.piece_id ? piecesById.get(c.piece_id) : null;
                if (cp?.image_url) { img = cp.image_url; break; }
              }
            }
            const annotated = (m as any).annotated_image_url as string | null;
            if (annotated) img = annotated;
            const status = effectiveStatus(m);
            const badge = STATUS_BADGE[status];
            const kitComponentCount = kit
              ? (componentsByParent.get(m.id)?.length ?? kitPieces.filter((kp) => kp.kit_id === kit.id).length)
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

                {annotated && (
                  <div className={`absolute ${kit ? 'top-10' : 'top-2'} left-2`}>
                    <Badge className="gap-1 text-[11px] bg-amber-500 text-white hover:bg-amber-500">
                      <Pencil className="w-3 h-3" /> Imagem alterada
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
          mockups={topLevel}
          allMockups={mockups}
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

      {/* Reset mockup dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => { if (!resetting) { setResetOpen(v); if (!v) setResetTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zerar mockup</DialogTitle>
            <DialogDescription>
              Esta ação apaga TODAS as observações, alterações propostas e toggles de TODAS as {total} peças/kits desta campanha, e define o status de todas para o que você escolher abaixo. Não pode ser desfeito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">Definir todas como:</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setResetTarget("pending")}
                className={`flex items-center gap-2 min-h-[48px] px-3 rounded-md border text-left transition-colors ${resetTarget === "pending" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <Clock className="w-4 h-4 text-muted-foreground" /> ⏳ Pendentes
              </button>
              <button
                type="button"
                onClick={() => setResetTarget("approved")}
                className={`flex items-center gap-2 min-h-[48px] px-3 rounded-md border text-left transition-colors ${resetTarget === "approved" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <CheckCircle2 className="w-4 h-4 text-green-600" /> ✅ Aprovadas
              </button>
              <button
                type="button"
                onClick={() => setResetTarget("rejected")}
                className={`flex items-center gap-2 min-h-[48px] px-3 rounded-md border text-left transition-colors ${resetTarget === "rejected" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <XCircle className="w-4 h-4 text-red-600" /> ❌ Reprovadas
              </button>
            </div>
            <label className="flex items-start gap-2 pt-3 cursor-pointer">
              <Checkbox
                checked={resetClearAnnotations}
                onCheckedChange={(v) => setResetClearAnnotations(v === true)}
                disabled={resetting}
                className="mt-0.5"
              />
              <span className="text-sm">
                Também remover imagens anotadas (voltar para as imagens originais)
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={resetting} onClick={() => { setResetOpen(false); setResetTarget(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!resetTarget || resetting} onClick={handleResetAll}>
              {resetting ? "Zerando..." : "Confirmar e zerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
