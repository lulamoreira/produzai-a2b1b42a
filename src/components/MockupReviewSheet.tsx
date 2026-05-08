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
} from "lucide-react";
import { useUpdateMockup, type CampaignMockup, type MockupStatus } from "@/hooks/useMockups";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mockups: CampaignMockup[];
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

export default function MockupReviewSheet({
  open,
  onOpenChange,
  mockups,
  initialMockupId,
  pieces,
  kits,
  campaignId,
}: Props) {
  const update = useUpdateMockup();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const debounceRefs = useRef<Record<string, any>>({});

  // Reset index when sheet opens
  useEffect(() => {
    if (!open) return;
    const idx = mockups.findIndex((m) => m.id === initialMockupId);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [open, initialMockupId, mockups]);

  const mockup = mockups[currentIndex];

  // Reset draft on mockup change
  useEffect(() => {
    setDraft({});
  }, [mockup?.id]);

  const piece = useMemo(() => {
    if (!mockup) return null;
    if (mockup.piece_id) return pieces.find((p) => p.id === mockup.piece_id) || null;
    return null;
  }, [mockup, pieces]);

  const kit = useMemo(() => {
    if (!mockup?.kit_id) return null;
    return kits.find((k) => k.id === mockup.kit_id) || null;
  }, [mockup, kits]);

  const displayName = piece?.name || kit?.name || "—";
  const imageUrl = piece?.image_url || kit?.image_url || null;

  const goToPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goToNext = () => setCurrentIndex((i) => Math.min(mockups.length - 1, i + 1));

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
    async (changes: Partial<CampaignMockup>, fieldKey?: string) => {
      if (!mockup) return;
      if (fieldKey) setSavingField(fieldKey);
      try {
        await update.mutateAsync({
          mockupId: mockup.id,
          campaignId,
          changes: changes as any,
        });
        flashSaved();
      } finally {
        if (fieldKey) setSavingField(null);
      }
    },
    [mockup, update, campaignId, flashSaved]
  );

  const debounceSave = (key: string, changes: Partial<CampaignMockup>) => {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(() => {
      saveChanges(changes, key);
    }, 800);
  };

  const updateStatus = (status: MockupStatus) => {
    saveChanges({ status }, "status");
  };

  if (!mockup) return null;

  const renderField = (
    key: "name" | "size" | "specification" | "installation",
    label: string,
    pieceValue: string | undefined | null,
    multiline = false
  ) => {
    const altKey = `alt_${key}` as keyof CampaignMockup;
    const activeKey = `alt_${key}_active` as keyof CampaignMockup;
    const altValue = (mockup[altKey] as string | null) ?? "";
    const isActive = !!mockup[activeKey];
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
                saveChanges({ [activeKey]: checked } as any, `${key}_active`)
              }
            />
          </div>
        </div>
        <div className="px-3 py-2 bg-muted/50 rounded-md text-base whitespace-pre-wrap break-words">
          {pieceValue || <span className="text-muted-foreground italic">—</span>}
        </div>
        {isActive && (
          multiline ? (
            <Textarea
              value={value || ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, [draftKey]: v }));
                debounceSave(key, { [altKey]: v } as any);
              }}
              onBlur={() => {
                if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
                saveChanges({ [altKey]: value || null } as any, key);
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
                debounceSave(key, { [altKey]: v } as any);
              }}
              onBlur={() => {
                if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
                saveChanges({ [altKey]: value || null } as any, key);
              }}
              className="text-base h-12"
              placeholder="Valor proposto..."
            />
          )
        )}
      </div>
    );
  };

  const meta = STATUS_META[mockup.status];
  const obsValue = draft.observations ?? mockup.observations ?? "";

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
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] gap-1 -ml-2"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="w-5 h-5" /> Voltar
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>P{currentIndex + 1} de {mockups.length}</span>
              <Badge className={meta.cls}>{meta.label}</Badge>
            </div>
            <div className="min-w-[60px] text-right text-xs text-muted-foreground">
              {savingField ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Salvando…</span>
              ) : savedFlash ? (
                <span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3 h-3" />Salvo</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content scrollable */}
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Image */}
          <div className="relative w-full bg-muted" style={{ height: "40vh", minHeight: 240 }}>
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

          <div className="p-3 text-base font-semibold">{displayName}</div>

          {/* Fields (only for piece-based mockups) */}
          {piece && (
            <>
              {renderField("name", "Nome", piece.name)}
              {renderField("size", "Tamanho", piece.size)}
              {renderField("specification", "Especificação", piece.specification, true)}
              {renderField("installation", "Instalação", piece.installation_instructions, true)}
            </>
          )}

          {kit && !piece && (
            <div className="p-4 border-b text-sm text-muted-foreground">
              Kit com componentes. Use a navegação para revisar cada peça do kit.
            </div>
          )}

          {/* Observations */}
          <div className="p-4 space-y-2 border-b">
            <Label>Observações</Label>
            <Textarea
              value={obsValue}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, observations: v }));
                debounceSave("observations", { observations: v });
              }}
              onBlur={() => {
                if (debounceRefs.current.observations) clearTimeout(debounceRefs.current.observations);
                saveChanges({ observations: obsValue || null }, "observations");
              }}
              rows={4}
              className="text-base"
              placeholder="Observações sobre esta peça..."
            />
          </div>
        </div>

        {/* Bottom action bar */}
        <div
          className="sticky bottom-0 bg-background border-t p-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Button
              className={`min-h-[56px] gap-1.5 text-white ${
                mockup.status === "approved"
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
                mockup.status === "changes_requested"
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
                mockup.status === "rejected"
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
              disabled={currentIndex === 0}
              className="min-h-[44px] flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              onClick={goToNext}
              disabled={currentIndex === mockups.length - 1}
              className="min-h-[44px] flex-1"
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

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
