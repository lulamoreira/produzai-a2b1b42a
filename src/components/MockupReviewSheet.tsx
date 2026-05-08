import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  X,
  Check,
  Loader2,
  ImageOff,
  Layers,
} from "lucide-react";
import {
  useUpdateMockup,
  computeKitRolledUpStatus,
  type CampaignMockup,
  type MockupStatus,
} from "@/hooks/useMockups";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mockups: CampaignMockup[]; // top-level (filtered) list user navigates through
  allMockups: CampaignMockup[]; // every mockup including kit components
  initialMockupId: string;
  pieces: any[];
  kits: any[];
  campaignId: string;
}

interface Draft {
  alt_name?: string | null;
  alt_size?: string | null;
  alt_specification?: string | null;
  alt_installation?: string | null;
  observations?: string | null;
}

const STATUS_META: Record<MockupStatus, { label: string; cls: string }> = {
  pending: { label: "⏳ Pendente", cls: "bg-muted text-foreground" },
  approved: { label: "✅ Aprovada", cls: "bg-green-600 text-white" },
  changes_requested: { label: "✏️ Alterações", cls: "bg-amber-600 text-white" },
  rejected: { label: "❌ Reprovada", cls: "bg-red-600 text-white" },
};

function StatusBadge({ status }: { status: MockupStatus }) {
  const meta = STATUS_META[status];
  return <Badge className={meta.cls}>{meta.label}</Badge>;
}

export default function MockupReviewSheet({
  open,
  onOpenChange,
  mockups,
  allMockups,
  initialMockupId,
  pieces,
  kits,
  campaignId,
}: Props) {
  const update = useUpdateMockup();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [kitDrilldownIndex, setKitDrilldownIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const debounceRefs = useRef<Record<string, any>>({});

  const piecesById = useMemo(() => {
    const m = new Map<string, any>();
    pieces.forEach((p) => m.set(p.id, p));
    return m;
  }, [pieces]);

  // Reset index when sheet opens
  useEffect(() => {
    if (!open) return;
    const idx = mockups.findIndex((m) => m.id === initialMockupId);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setKitDrilldownIndex(null);
  }, [open, initialMockupId, mockups]);

  const parentMockup = mockups[currentIndex];
  const isKit = !!parentMockup?.kit_id && !parentMockup.parent_mockup_id;

  // Kit components (sorted)
  const kitComponents = useMemo(() => {
    if (!isKit || !parentMockup) return [];
    return allMockups
      .filter((m) => m.parent_mockup_id === parentMockup.id)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  }, [isKit, parentMockup, allMockups]);

  // The mockup currently being edited (component if drilled-in, else parent)
  const activeMockup: CampaignMockup | undefined =
    isKit && kitDrilldownIndex !== null ? kitComponents[kitDrilldownIndex] : parentMockup;

  // Reset draft when active mockup changes
  useEffect(() => {
    setDraft({});
  }, [activeMockup?.id]);

  const piece = useMemo(() => {
    if (!activeMockup) return null;
    if (activeMockup.piece_id) return piecesById.get(activeMockup.piece_id) || null;
    return null;
  }, [activeMockup, piecesById]);

  const kit = useMemo(() => {
    if (!parentMockup?.kit_id) return null;
    return kits.find((k) => k.id === parentMockup.kit_id) || null;
  }, [parentMockup, kits]);

  // Image fallback for kits: kit.image_url -> first component piece image
  const kitImage = useMemo(() => {
    if (kit?.image_url) return kit.image_url;
    for (const comp of kitComponents) {
      const cp = comp.piece_id ? piecesById.get(comp.piece_id) : null;
      if (cp?.image_url) return cp.image_url;
    }
    return null;
  }, [kit, kitComponents, piecesById]);

  const displayName =
    isKit && kitDrilldownIndex === null
      ? kit?.name || "Kit"
      : piece?.name || kit?.name || "—";
  const imageUrl =
    isKit && kitDrilldownIndex === null ? kitImage : piece?.image_url || kit?.image_url || null;

  // ─── Navigation ──
  const goToPrev = () => {
    if (isKit && kitDrilldownIndex !== null) {
      if (kitDrilldownIndex > 0) setKitDrilldownIndex(kitDrilldownIndex - 1);
      return;
    }
    setCurrentIndex((i) => Math.max(0, i - 1));
  };
  const goToNext = () => {
    if (isKit && kitDrilldownIndex !== null) {
      if (kitDrilldownIndex < kitComponents.length - 1) {
        setKitDrilldownIndex(kitDrilldownIndex + 1);
      } else {
        // Exit drill-down at end of kit
        setKitDrilldownIndex(null);
      }
      return;
    }
    setCurrentIndex((i) => Math.min(mockups.length - 1, i + 1));
  };

  const canPrev = isKit && kitDrilldownIndex !== null ? kitDrilldownIndex > 0 : currentIndex > 0;
  const canNext =
    isKit && kitDrilldownIndex !== null ? true : currentIndex < mockups.length - 1;

  // Swipe handlers
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goToNext();
      else goToPrev();
    }
    touchStart.current = null;
  };

  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, []);

  const saveChanges = useCallback(
    async (mockupId: string, changes: Partial<CampaignMockup>, fieldKey?: string) => {
      if (fieldKey) setSavingField(fieldKey);
      try {
        await update.mutateAsync({
          mockupId,
          campaignId,
          changes: changes as any,
        });
        flashSaved();
      } finally {
        if (fieldKey) setSavingField(null);
      }
    },
    [update, campaignId, flashSaved]
  );

  const debounceSave = (key: string, mockupId: string, changes: Partial<CampaignMockup>) => {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(() => {
      saveChanges(mockupId, changes, key);
    }, 800);
  };

  const updateStatus = (status: MockupStatus) => {
    if (!activeMockup) return;
    saveChanges(activeMockup.id, { status }, "status");
  };

  const setAllComponents = async (status: MockupStatus) => {
    if (kitComponents.length === 0) return;
    setSavingField("status");
    try {
      await Promise.all(
        kitComponents.map((c) =>
          update.mutateAsync({
            mockupId: c.id,
            campaignId,
            changes: { status } as any,
          })
        )
      );
      flashSaved();
    } finally {
      setSavingField(null);
    }
  };

  if (!parentMockup || !activeMockup) return null;

  const renderField = (
    key: "name" | "size" | "specification" | "installation",
    label: string,
    pieceValue: string | undefined | null,
    multiline = false
  ) => {
    const m = activeMockup!;
    const altKey = `alt_${key}` as keyof CampaignMockup;
    const activeKey = `alt_${key}_active` as keyof CampaignMockup;
    const altValue = (m[altKey] as string | null) ?? "";
    const isActive = !!m[activeKey];
    const draftKey = `alt_${key}` as keyof Draft;
    const draftValue = draft[draftKey];
    const value = draftValue ?? altValue;

    return (
      <div className="space-y-2 p-4 border-b">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Alterar</span>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) =>
                saveChanges(m.id, { [activeKey]: checked } as any, `${key}_active`)
              }
            />
          </div>
        </div>
        <div className="px-3 py-2 bg-muted/50 rounded-md text-base whitespace-pre-wrap break-words">
          {pieceValue || <span className="text-muted-foreground italic">—</span>}
        </div>
        {isActive &&
          (multiline ? (
            <Textarea
              value={value || ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, [draftKey]: v }));
                debounceSave(key, m.id, { [altKey]: v } as any);
              }}
              onBlur={() => {
                if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
                saveChanges(m.id, { [altKey]: value || null } as any, key);
              }}
              rows={3}
              className="text-base"
              placeholder="Valor proposto..."
            />
          ) : (
            <Input
              value={value || ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, [draftKey]: v }));
                debounceSave(key, m.id, { [altKey]: v } as any);
              }}
              onBlur={() => {
                if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
                saveChanges(m.id, { [altKey]: value || null } as any, key);
              }}
              className="text-base h-12"
              placeholder="Valor proposto..."
            />
          ))}
      </div>
    );
  };

  // Status displayed in top bar
  const headerStatus: MockupStatus =
    isKit && kitDrilldownIndex === null && kitComponents.length > 0
      ? computeKitRolledUpStatus(kitComponents)
      : activeMockup.status;
  const headerMeta = STATUS_META[headerStatus];

  const obsValue = draft.observations ?? activeMockup.observations ?? "";

  // Top bar title
  let topTitle: string;
  if (isKit && kitDrilldownIndex === null) {
    topTitle = `Kit — Visão geral`;
  } else if (isKit && kitDrilldownIndex !== null) {
    topTitle = `Componente ${kitDrilldownIndex + 1} de ${kitComponents.length}`;
  } else {
    topTitle = `P${currentIndex + 1} de ${mockups.length}`;
  }

  const showFields = !(isKit && kitDrilldownIndex === null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-full p-0 flex flex-col h-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-background border-b">
          <div className="flex items-center justify-between gap-2 px-3 h-14">
            {isKit && kitDrilldownIndex !== null ? (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] gap-1 -ml-2"
                onClick={() => setKitDrilldownIndex(null)}
              >
                <ArrowLeft className="w-5 h-5" /> Voltar ao kit
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] gap-1 -ml-2"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="w-5 h-5" /> Voltar
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{topTitle}</span>
              <Badge className={headerMeta.cls}>{headerMeta.label}</Badge>
            </div>
            <div className="min-w-[60px] text-right text-xs text-muted-foreground">
              {savingField ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Salvando…
                </span>
              ) : savedFlash ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check className="w-3 h-3" />
                  Salvo
                </span>
              ) : null}
            </div>
          </div>

          {/* Kit progress dots */}
          {isKit && kitDrilldownIndex !== null && kitComponents.length > 0 && (
            <div className="flex justify-center gap-1.5 pb-2">
              {kitComponents.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === kitDrilldownIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Image */}
          <div
            className="relative w-full bg-muted"
            style={{ height: "40vh", minHeight: 240 }}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt={displayName}
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  className="absolute inset-0"
                  aria-label="Ampliar imagem"
                  onClick={() => setFullscreen(true)}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ImageOff className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="p-3 text-base font-semibold flex items-center gap-2">
            {isKit && kitDrilldownIndex === null && <Layers className="w-4 h-4" />}
            {displayName}
            {isKit && kitDrilldownIndex === null && (
              <span className="text-xs font-normal text-muted-foreground">
                ({kitComponents.length} peças)
              </span>
            )}
          </div>

          {/* Kit overview: components grid + bulk actions */}
          {isKit && kitDrilldownIndex === null && (
            <div className="px-3 pb-4">
              {kitComponents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Este kit ainda não possui componentes em mockup.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {kitComponents.map((comp, idx) => {
                      const cp = comp.piece_id ? piecesById.get(comp.piece_id) : null;
                      return (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => setKitDrilldownIndex(idx)}
                          className="rounded-lg border overflow-hidden text-left min-h-[180px] bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {cp?.image_url ? (
                            <img
                              src={cp.image_url}
                              alt={cp.name}
                              className="aspect-square object-cover w-full"
                              loading="lazy"
                            />
                          ) : (
                            <div className="aspect-square w-full bg-muted flex items-center justify-center">
                              <ImageOff className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="p-2 space-y-1">
                            <div className="text-sm font-medium line-clamp-2">
                              {cp?.name || "—"}
                            </div>
                            <StatusBadge status={comp.status} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-muted/30 rounded-md text-sm">
                    Aplicar ao kit inteiro:
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <Button
                      className="min-h-[48px] gap-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => setAllComponents("approved")}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Aprovar todos
                    </Button>
                    <Button
                      className="min-h-[48px] gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      onClick={() => setAllComponents("changes_requested")}
                    >
                      <Edit3 className="w-4 h-4" /> Alterações
                    </Button>
                    <Button
                      className="min-h-[48px] gap-1 bg-red-600 hover:bg-red-700 text-white text-xs"
                      onClick={() => setAllComponents("rejected")}
                    >
                      <XCircle className="w-4 h-4" /> Reprovar todos
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Piece review fields */}
          {showFields && piece && (
            <>
              {renderField("name", "Nome", piece.name)}
              {renderField("size", "Tamanho", piece.size)}
              {renderField("specification", "Especificação", piece.specification, true)}
              {renderField("installation", "Instalação", piece.installation_instructions, true)}
            </>
          )}

          {/* Observations (only when reviewing a piece, not kit overview) */}
          {showFields && (
            <div className="p-4 space-y-2 border-b">
              <Label>Observações</Label>
              <Textarea
                value={obsValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({ ...d, observations: v }));
                  debounceSave("observations", activeMockup.id, { observations: v });
                }}
                onBlur={() => {
                  if (debounceRefs.current.observations)
                    clearTimeout(debounceRefs.current.observations);
                  saveChanges(
                    activeMockup.id,
                    { observations: obsValue || null },
                    "observations"
                  );
                }}
                rows={4}
                className="text-base"
                placeholder="Observações sobre esta peça..."
              />
            </div>
          )}
        </div>

        {/* Bottom action bar — only in piece review (not kit overview, which has its own bulk actions) */}
        {showFields && (
          <div
            className="sticky bottom-0 bg-background border-t p-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Button
                className={`min-h-[56px] gap-1.5 text-white ${
                  activeMockup.status === "approved"
                    ? "bg-green-700 hover:bg-green-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                onClick={() => updateStatus("approved")}
              >
                <CheckCircle2 className="w-5 h-5" />
                Aprovar
              </Button>
              <Button
                className={`min-h-[56px] gap-1.5 text-white ${
                  activeMockup.status === "changes_requested"
                    ? "bg-amber-700 hover:bg-amber-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
                onClick={() => updateStatus("changes_requested")}
              >
                <Edit3 className="w-5 h-5" />
                Alterações
              </Button>
              <Button
                className={`min-h-[56px] gap-1.5 text-white ${
                  activeMockup.status === "rejected"
                    ? "bg-red-700 hover:bg-red-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                onClick={() => updateStatus("rejected")}
              >
                <XCircle className="w-5 h-5" />
                Reprovar
              </Button>
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={goToPrev}
                disabled={!canPrev}
                className="min-h-[44px] flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />{" "}
                {isKit && kitDrilldownIndex !== null ? "Anterior componente" : "Anterior"}
              </Button>
              <Button
                variant="outline"
                onClick={goToNext}
                disabled={!canNext}
                className="min-h-[44px] flex-1"
              >
                {isKit && kitDrilldownIndex !== null ? "Próximo componente" : "Próxima"}{" "}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Kit overview bottom nav (between mockups in main list) */}
        {isKit && kitDrilldownIndex === null && (
          <div
            className="sticky bottom-0 bg-background border-t p-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={goToPrev}
                disabled={!canPrev}
                className="min-h-[44px] flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                onClick={goToNext}
                disabled={!canNext}
                className="min-h-[44px] flex-1"
              >
                Próxima <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Fullscreen image overlay */}
        {fullscreen && imageUrl && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setFullscreen(false)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(false);
              }}
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageUrl}
              alt={displayName}
              className="max-w-full max-h-full object-contain"
              style={{ touchAction: "pinch-zoom" }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
