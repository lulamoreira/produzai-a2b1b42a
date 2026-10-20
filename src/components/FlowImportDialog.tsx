import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageOff, Images, Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compressImage } from "@/lib/compressImage";
import { disambiguateKitPieceNames } from "@/lib/disambiguateKitPieces";
import { ensureCampaignLocations } from "@/lib/ensureCampaignLocations";
import { combineImagesVertically, fetchImageBlob, runInBatches } from "@/lib/flowImages";
import type { FlowParsedPiece } from "@/lib/parseFlowWorkbook";
import { canReplaceImage, matchFlowRows, type ExistingPieceRef } from "@/lib/flowImageMatch";

interface FlowImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  pieces: FlowParsedPiece[];
  /** "images": não cria peças; só reaplica imagens nas peças já existentes. */
  mode?: "create" | "images";
}

type ImageState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; blob: Blob; preview: string; combined: number }
  | { status: "failed" };

interface FlowRow {
  id: string;
  piece: FlowParsedPiece;
  image: ImageState;
}

const DEFAULT_SPECIFICATION = "Vide Book/Manual";
type EditableField = "name" | "category" | "subLocation" | "size";

export function FlowImportDialog({ open, onOpenChange, campaignId, campaignName, pieces, mode = "create" }: FlowImportDialogProps) {
  useTranslation();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [downloaded, setDownloaded] = useState(0);
  const [importing, setImporting] = useState(false);
  const [existing, setExisting] = useState<ExistingPieceRef[]>([]);
  const runRef = useRef<symbol | null>(null);
  const imagesOnly = mode === "images";

  const withImages = useMemo(() => pieces.filter((p) => p.imageUrls.length > 0).length, [pieces]);

  useEffect(() => {
    if (!open || !imagesOnly) return;
    void supabase
      .from("campaign_pieces")
      .select("id, code, name, category, image_url")
      .eq("campaign_id", campaignId)
      .eq("is_deleted", false)
      .order("code")
      .then(({ data, error }) => {
        if (error) toast.error(`Erro ao ler peças: ${error.message}`);
        setExisting((data || []) as ExistingPieceRef[]);
      });
  }, [open, imagesOnly, campaignId]);

  const matches = useMemo(
    () => (imagesOnly ? matchFlowRows(rows.map((r) => ({ name: r.piece.name, category: r.piece.category })), existing) : []),
    [imagesOnly, rows, existing],
  );

  const handleApplyImages = async () => {
    if (importing) return;
    setImporting(true);
    const toastId = "flow-images";
    let ok = 0, failed = 0, skipped = 0;
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const target = matches[i];
        const image = rows[i].image;
        if (!target || image.status !== "ready") continue;
        if (!canReplaceImage(target.image_url)) { skipped += 1; continue; }
        toast.loading(`Enviando imagens... ${i + 1}/${rows.length}`, { id: toastId });
        const url = await uploadImage(image.blob, target.code);
        if (!url) { failed += 1; continue; }
        const { error } = await supabase.from("campaign_pieces").update({ image_url: url }).eq("id", target.id);
        if (error) { failed += 1; continue; }
        ok += 1;
      }
      await queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
      toast.success(`${ok} imagem(ns) aplicada(s)`, {
        id: toastId,
        description: [failed && `${failed} falharam`, skipped && `${skipped} já tinham imagem própria (mantidas)`].filter(Boolean).join(" · ") || undefined,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(`Erro: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  // Semeia linhas e baixa imagens (3 por vez) a cada abertura.
  useEffect(() => {
    if (!open) {
      runRef.current = null;
      return;
    }
    const run = Symbol("flow-images");
    runRef.current = run;
    const seeded: FlowRow[] = pieces.map((piece) => ({
      id: crypto.randomUUID(),
      piece: { ...piece },
      image: piece.imageUrls.length ? { status: "loading" } : { status: "none" },
    }));
    setRows(seeded);
    setDownloaded(0);

    const setImage = (id: string, image: ImageState) =>
      setRows((current) => current.map((r) => (r.id === id ? { ...r, image } : r)));

    void runInBatches(seeded.filter((r) => r.piece.imageUrls.length), 3, async (row) => {
      try {
        const blobs: Blob[] = [];
        for (const url of row.piece.imageUrls) blobs.push(await fetchImageBlob(url));
        const blob = await combineImagesVertically(blobs);
        if (runRef.current !== run) return;
        setImage(row.id, { status: "ready", blob, preview: URL.createObjectURL(blob), combined: blobs.length });
      } catch (error: unknown) {
        console.warn("flow image download failed", row.piece.sourceName, error);
        if (runRef.current === run) setImage(row.id, { status: "failed" });
      } finally {
        if (runRef.current === run) setDownloaded((n) => n + 1);
      }
    });
  }, [open, pieces]);

  const stillLoading = rows.some((r) => r.image.status === "loading");
  const failedCount = rows.filter((r) => r.image.status === "failed").length;

  const updateField = (id: string, field: EditableField, value: string) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, piece: { ...r.piece, [field]: value } } : r)));

  const uploadImage = async (blob: Blob, code: number): Promise<string | null> => {
    try {
      const file = new File([blob], `flow-${code}.jpg`, { type: blob.type || "image/jpeg" });
      const compressed = await compressImage(file, 1200, 0.7);
      const path = `flow-piece-${code}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("piece-images")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      if (!data?.path) throw new Error("Upload sem confirmação do servidor");
      const publicUrl = supabase.storage.from("piece-images").getPublicUrl(data.path).data.publicUrl;
      // Confirma que o arquivo realmente existe antes de gravar o link na peça.
      const check = await fetch(publicUrl, { method: "HEAD", cache: "no-store" });
      if (!check.ok) throw new Error(`Arquivo não encontrado após envio (HTTP ${check.status})`);
      return publicUrl;
    } catch (error: unknown) {
      console.warn("flow image upload failed", code, error);
      return null;
    }
  };

  const handleConfirm = async () => {
    const valid = rows.filter((r) => r.piece.name.trim());
    if (importing || valid.length === 0) return;
    setImporting(true);
    const toastId = "flow-import";
    toast.loading("Importando peças do Flow...", { id: toastId });
    try {
      const [{ data: lastPiece, error: codeError }, { data: maxPieceOrder }, { data: maxKitOrder }] = await Promise.all([
        supabase.from("campaign_pieces").select("code").eq("campaign_id", campaignId).eq("is_deleted", false)
          .order("code", { ascending: false }).limit(1),
        supabase.from("campaign_pieces").select("display_order").eq("campaign_id", campaignId).eq("is_deleted", false)
          .order("display_order", { ascending: false }).limit(1),
        supabase.from("campaign_kits").select("display_order").eq("campaign_id", campaignId).eq("is_deleted", false)
          .order("display_order", { ascending: false }).limit(1),
      ]);
      if (codeError) throw codeError;
      let nextCode = (lastPiece?.[0]?.code ?? 0) + 1;
      let nextOrder = Math.max(maxPieceOrder?.[0]?.display_order ?? -1, maxKitOrder?.[0]?.display_order ?? -1) + 1;
      let imageFailures = 0;

      for (let i = 0; i < valid.length; i += 1) {
        const { piece, image } = valid[i];
        const code = nextCode++;
        toast.loading(`Importando peças do Flow... ${i + 1}/${valid.length}`, { id: toastId });
        const imageUrl = image.status === "ready" ? await uploadImage(image.blob, code) : null;
        if (image.status === "ready" && !imageUrl) imageFailures += 1;
        const { error } = await supabase.from("campaign_pieces").insert({
          campaign_id: campaignId,
          code,
          name: piece.name.trim(),
          category: piece.category.trim().toUpperCase(),
          size: piece.size.trim(),
          kit_only: false,
          is_mockup: false,
          sub_location: piece.subLocation.trim() || null,
          specification: piece.specification.trim() || DEFAULT_SPECIFICATION,
          installation_instructions: "Sem informações específicas",
          image_url: imageUrl,
          is_deleted: false,
          is_new: false,
          display_order: nextOrder++,
        });
        if (error) throw error;
      }

      await disambiguateKitPieceNames(campaignId);
      await ensureCampaignLocations(campaignId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_piece_locations"] }),
      ]);
      toast.success(`Importadas ${valid.length} peças do Flow`, {
        id: toastId,
        description: imageFailures ? `${imageFailures} imagem(ns) não puderam ser enviadas.` : undefined,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(`Erro ao importar: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  const renderImage = (image: ImageState) => {
    if (image.status === "loading") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Baixando imagem" />;
    if (image.status === "ready") {
      return (
        <div className="flex flex-col items-start gap-1">
          <img src={image.preview} alt="" className="h-14 w-14 rounded border bg-background object-contain" />
          {image.combined > 1 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary"><Images className="h-3 w-3" /> {image.combined} imagens combinadas</span>
          )}
        </div>
      );
    }
    if (image.status === "failed") {
      return <span className="text-[11px] font-medium text-destructive">Imagem não baixada — reexporte o Flow</span>;
    }
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ImageOff className="h-3 w-3" /> sem imagem</span>;
  };

  const fields: Array<{ key: EditableField; label: string; width: string }> = [
    { key: "name", label: "Nome", width: "w-72" },
    { key: "category", label: "Localização", width: "w-48" },
    { key: "subLocation", label: "Subgrupo", width: "w-44" },
    { key: "size", label: "Medidas", width: "w-32" },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90dvh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 lg:max-w-6xl">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>Conferir importação do Flow</DialogTitle>
          <DialogDescription>
            Revise os dados antes de importar para {campaignName}. Nada será gravado até a confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-6">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border bg-muted px-3 py-1 text-sm font-medium">{rows.length} peças</span>
            <span className="rounded-md border bg-muted px-3 py-1 text-sm font-medium">{withImages} com imagem</span>
            {failedCount > 0 && (
              <span className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                {failedCount} imagem(ns) não baixada(s) — reexporte o Flow
              </span>
            )}
          </div>
          {withImages > 0 && stillLoading && (
            <div className="flex items-center gap-3" aria-live="polite">
              <Progress value={(downloaded / withImages) * 100} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">Baixando imagens {downloaded}/{withImages}</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto border-y">
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {fields.map((f) => <TableHead key={f.key} className={f.width}>{f.label}</TableHead>)}
                <TableHead className="w-56">Especificação</TableHead>
                <TableHead className="w-40">Imagem</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="p-2 text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                  {fields.map((f) => (
                    <TableCell key={f.key} className="p-1.5">
                      <Input
                        aria-label={`${f.label} da linha ${index + 1}`}
                        value={row.piece[f.key]}
                        onChange={(e) => updateField(row.id, f.key, e.target.value)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="p-1.5 text-xs text-muted-foreground">{row.piece.specification || DEFAULT_SPECIFICATION}</TableCell>
                  <TableCell className="p-1.5">{renderImage(row.image)}</TableCell>
                  <TableCell className="p-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover linha ${index + 1}`}
                      onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="px-6 pb-5">
          <Button type="button" variant="outline" disabled={importing} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={importing || stillLoading || rows.length === 0} onClick={() => void handleConfirm()}>
            {importing ? "Importando..." : stillLoading ? "Baixando imagens..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
