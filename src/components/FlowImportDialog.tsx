import { assertStoredImage } from "@/lib/assertStoredImage";
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
import { buildFlowImportRecords, flowKitMatchName, flowNameWithoutKit, isFlowKit, parseKitComponents } from "@/lib/flowKitImport";
import { ensureCampaignLocations } from "@/lib/ensureCampaignLocations";
import { combineImagesVertically, fetchImageBlob, runInBatches } from "@/lib/flowImages";
import type { FlowParsedPiece } from "@/lib/parseFlowWorkbook";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { buildSpecMatcher, canReplaceSpec, normCat, type SpecMatcher } from "@/lib/flowCategorySpec";
import { canReplaceImage, matchFlowRows, type ExistingPieceRef } from "@/lib/flowImageMatch";

interface FlowImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  pieces: FlowParsedPiece[];
  /** "images": não cria peças; só reaplica imagens nas peças já existentes. */
  mode?: "create" | "images" | "specs";
  /** Cliente da campanha: base de categorias e especificações de outras campanhas. */
  clientId?: string;
}

interface ClientCatalog {
  categories: string[];
  matchSpec: SpecMatcher;
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
  specSuggested: boolean;
  enriched: boolean;
}

const DEFAULT_SPECIFICATION = "Vide Book/Manual";
type EditableField = "name" | "category" | "subLocation" | "size" | "specification";

export function FlowImportDialog({ open, onOpenChange, campaignId, campaignName, pieces, mode = "create", clientId }: FlowImportDialogProps) {
  useTranslation();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [downloaded, setDownloaded] = useState(0);
  const [importing, setImporting] = useState(false);
  const [existing, setExisting] = useState<ExistingPieceRef[]>([]);
  const [existingKits, setExistingKits] = useState<ExistingPieceRef[]>([]);
  const runRef = useRef<symbol | null>(null);
  const imagesOnly = mode === "images";
  const specsOnly = mode === "specs";
  const matchExisting = imagesOnly || specsOnly;
  const [catalog, setCatalog] = useState<ClientCatalog | null>(null);
  const [progress, setProgress] = useState(0);

  /** Aplica Localização padronizada (Demanda) e Especificação sugerida às linhas ainda não tratadas. */
  const enrich = (row: FlowRow, cat: ClientCatalog): FlowRow => {
    if (row.enriched) return row;
    const category = row.piece.demanda ? normCat(row.piece.demanda, cat.categories) || row.piece.category : row.piece.category;
    const suggested = canReplaceSpec(row.piece.specification) ? cat.matchSpec(row.piece.name) : null;
    return {
      ...row,
      enriched: true,
      specSuggested: Boolean(suggested),
      piece: { ...row.piece, category, specification: suggested ?? row.piece.specification },
    };
  };

  // Carrega uma vez as peças das OUTRAS campanhas do mesmo cliente (paginado).
  useEffect(() => {
    if (!open) { setCatalog(null); return; }
    if (!clientId) { setCatalog({ categories: [], matchSpec: () => null }); return; }
    let cancelled = false;
    void (async () => {
      try {
        const data = await supabasePaginate<{ id: string; name: string; category: string | null; specification: string | null }>((from, to) =>
          supabase
            .from("campaign_pieces")
            .select("id, name, category, specification, campaigns!inner(client_id)", { count: "exact" })
            .eq("campaigns.client_id", clientId)
            .neq("campaign_id", campaignId)
            .eq("is_deleted", false)
            .order("id")
            .range(from, to) as never,
        );
        if (cancelled) return;
        const categories = [...new Set(data.map((p) => (p.category || "").trim()).filter(Boolean))];
        setCatalog({ categories, matchSpec: buildSpecMatcher(data.map((p) => ({ name: p.name, specification: p.specification }))) });
      } catch (error: unknown) {
        console.warn("flow client catalog failed", error);
        if (!cancelled) setCatalog({ categories: [], matchSpec: () => null });
      }
    })();
    return () => { cancelled = true; };
  }, [open, clientId, campaignId]);

  useEffect(() => {
    if (catalog) setRows((current) => current.map((r) => enrich(r, catalog)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, rows.length]);

  const withImages = useMemo(() => pieces.filter((p) => p.imageUrls.length > 0).length, [pieces]);

  useEffect(() => {
    if (!open || !matchExisting) return;
    void supabase
      .from("campaign_pieces")
      .select("id, code, name, category, image_url, specification")
      .eq("campaign_id", campaignId)
      .eq("is_deleted", false)
      .order("code")
      .then(({ data, error }) => {
        if (error) toast.error(`Erro ao ler peças: ${error.message}`);
        setExisting((data || []) as ExistingPieceRef[]);
      });
  }, [open, matchExisting, campaignId]);

  // No modo "imagens", os kits da campanha também são carregados para receber a imagem.
  useEffect(() => {
    if (!open || !imagesOnly) { setExistingKits([]); return; }
    void supabase
      .from("campaign_kits")
      .select("id, code, name, category, image_url")
      .eq("campaign_id", campaignId)
      .eq("is_deleted", false)
      .order("code")
      .then(({ data, error }) => {
        if (error) toast.error(`Erro ao ler kits: ${error.message}`);
        setExistingKits((data || []) as ExistingPieceRef[]);
      });
  }, [open, imagesOnly, campaignId]);

  // No modo "imagens", linhas-KIT casam com kits; as demais (e todo o modo "specs") casam com peças.
  const matches = useMemo(() => {
    if (!matchExisting) return [];
    const indexes = rows.map((r, i) => (imagesOnly && isFlowKit(r.piece.sourceName) ? -1 : i)).filter((i) => i >= 0);
    const hits = matchFlowRows(indexes.map((i) => ({ name: rows[i].piece.name, category: rows[i].piece.category })), existing);
    const result: Array<ExistingPieceRef | null> = rows.map(() => null);
    indexes.forEach((rowIndex, i) => { result[rowIndex] = hits[i]; });
    return result;
  }, [matchExisting, rows, existing, imagesOnly]);

  const kitMatches = useMemo(() => {
    const map = new Map<number, ExistingPieceRef>();
    if (!imagesOnly) return map;
    const indexes = rows.map((r, i) => (isFlowKit(r.piece.sourceName) ? i : -1)).filter((i) => i >= 0);
    const hits = matchFlowRows(indexes.map((i) => ({ name: flowKitMatchName(rows[i].piece.name), category: rows[i].piece.category })), existingKits);
    indexes.forEach((rowIndex, i) => { const hit = hits[i]; if (hit) map.set(rowIndex, hit); });
    return map;
  }, [imagesOnly, rows, existingKits]);

  const handleApplyImages = async () => {
    if (importing) return;
    setImporting(true);
    const toastId = "flow-images";
    let ok = 0, failed = 0, skipped = 0;
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const kit = kitMatches.get(i);
        const target = kit ?? matches[i];
        const image = rows[i].image;
        if (!target || image.status !== "ready") continue;
        if (!canReplaceImage(target.image_url)) { skipped += 1; continue; }
        toast.loading(`Enviando imagens... ${i + 1}/${rows.length}`, { id: toastId });
        const url = await uploadImage(image.blob, target.code);
        if (!url) { failed += 1; continue; }
        if (kit) {
          // Linha-KIT: a imagem vai para o kit e para a 1ª peça componente (a mesma do import).
          const { error } = await supabase.from("campaign_kits").update({ image_url: url }).eq("id", kit.id);
          if (error) { failed += 1; continue; }
          const { data: links } = await supabase
            .from("campaign_kit_pieces")
            .select("piece_id")
            .eq("kit_id", kit.id)
            .order("display_order")
            .limit(1);
          const pieceId = links?.[0]?.piece_id;
          if (pieceId) {
            const { data: component } = await supabase.from("campaign_pieces").select("id, image_url").eq("id", pieceId).maybeSingle();
            if (component && canReplaceImage(component.image_url)) {
              await supabase.from("campaign_pieces").update({ image_url: url }).eq("id", component.id);
            }
          }
          ok += 1;
          continue;
        }
        const { error } = await supabase.from("campaign_pieces").update({ image_url: url }).eq("id", target.id);
        if (error) { failed += 1; continue; }
        ok += 1;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kits"] }),
      ]);
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

  const handleApplySpecs = async () => {
    if (importing) return;
    setImporting(true);
    setProgress(0);
    let ok = 0, failed = 0;
    try {
      for (let i = 0; i < rows.length; i += 1) {
        setProgress(((i + 1) / rows.length) * 100);
        const target = matches[i];
        if (!target) continue;
        const piece = rows[i].piece;
        const update: { category?: string; specification?: string } = {};
        const category = piece.category.trim().toUpperCase();
        if (category && category !== (target.category || "")) update.category = category;
        const spec = piece.specification.trim();
        if (rows[i].specSuggested && spec && canReplaceSpec(target.specification) && spec !== target.specification) update.specification = spec;
        if (!Object.keys(update).length) continue;
        const { error } = await supabase.from("campaign_pieces").update(update).eq("id", target.id);
        if (error) { failed += 1; continue; }
        ok += 1;
      }
      await ensureCampaignLocations(campaignId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_piece_locations"] }),
      ]);
      toast.success(`${ok} peças atualizadas`, { description: failed ? `${failed} falharam` : undefined });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
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
      piece: { ...piece, name: mode === "create" && isFlowKit(piece.sourceName) ? flowNameWithoutKit(piece.name) : piece.name },
      image: piece.imageUrls.length && !specsOnly ? { status: "loading" } : { status: "none" },
      specSuggested: false,
      enriched: false,
    }));
    setRows(seeded);
    setDownloaded(0);

    const setImage = (id: string, image: ImageState) =>
      setRows((current) => current.map((r) => (r.id === id ? { ...r, image } : r)));

    if (specsOnly) return;
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
  }, [open, pieces, specsOnly, mode]);

  const stillLoading = rows.some((r) => r.image.status === "loading");
  const failedCount = rows.filter((r) => r.image.status === "failed").length;

  const updateField = (id: string, field: EditableField, value: string) =>
    setRows((current) => current.map((r) => (r.id === id
      ? { ...r, specSuggested: field === "specification" ? false : r.specSuggested, piece: { ...r.piece, [field]: value } }
      : r)));

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
      await assertStoredImage(publicUrl);
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
      const [lastPieceResult, lastKitResult, pieceOrderResult, kitOrderResult] = await Promise.all([
        supabase.from("campaign_pieces").select("code").eq("campaign_id", campaignId)
          .order("code", { ascending: false }).limit(1),
        supabase.from("campaign_kits").select("code").eq("campaign_id", campaignId)
          .order("code", { ascending: false }).limit(1),
        supabase.from("campaign_pieces").select("display_order").eq("campaign_id", campaignId).eq("is_deleted", false)
          .order("display_order", { ascending: false }).limit(1),
        supabase.from("campaign_kits").select("display_order").eq("campaign_id", campaignId).eq("is_deleted", false)
          .order("display_order", { ascending: false }).limit(1),
      ]);
      for (const result of [lastPieceResult, lastKitResult, pieceOrderResult, kitOrderResult]) {
        if (result.error) throw result.error;
      }
      let nextCode = Math.max(lastPieceResult.data?.[0]?.code ?? 0, lastKitResult.data?.[0]?.code ?? 0) + 1;
      let nextOrder = Math.max(pieceOrderResult.data?.[0]?.display_order ?? -1, kitOrderResult.data?.[0]?.display_order ?? -1) + 1;
      let imageFailures = 0;

      for (let i = 0; i < valid.length; i += 1) {
        const { piece, image } = valid[i];
        const code = nextCode;
        toast.loading(`Importando peças do Flow... ${i + 1}/${valid.length}`, { id: toastId });
        const imageUrl = image.status === "ready" ? await uploadImage(image.blob, code) : null;
        if (image.status === "ready" && !imageUrl) imageFailures += 1;
        const records = buildFlowImportRecords(piece, campaignId, nextCode, nextOrder, imageUrl);
        if (records.kit) {
          // IDs are known in advance; cleanup is limited to this new, incomplete kit.
          const kitId = crypto.randomUUID();
          const pieceIds = records.pieces.map(() => crypto.randomUUID());
          const { error: kitError } = await supabase.from("campaign_kits").insert({ ...records.kit, id: kitId });
          if (kitError) throw kitError;
          try {
            for (let p = 0; p < records.pieces.length; p += 1) {
              const { error: pieceError } = await supabase.from("campaign_pieces").insert({ ...records.pieces[p], id: pieceIds[p] });
              if (pieceError) throw pieceError;
              const { error: linkError } = await supabase.from("campaign_kit_pieces").insert({ kit_id: kitId, piece_id: pieceIds[p], quantity: 1, display_order: p });
              if (linkError) throw linkError;
            }
          } catch (error: unknown) {
            const cleanup = await Promise.all([
              ...pieceIds.map((pieceId) => supabase.from("campaign_pieces").delete().eq("id", pieceId).eq("campaign_id", campaignId)),
              supabase.from("campaign_kits").delete().eq("id", kitId).eq("campaign_id", campaignId),
            ]);
            if (cleanup.some((result) => result.error)) toast.error("Não foi possível remover o kit incompleto; confira a lista antes de tentar novamente.");
            throw error;
          }
        } else {
          const { error } = await supabase.from("campaign_pieces").insert(records.pieces[0]);
          if (error) throw error;
        }
        nextCode = records.nextCode;
        nextOrder = records.nextOrder;
      }

      await ensureCampaignLocations(campaignId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kits"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }),
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
          <DialogTitle>{specsOnly ? "Reaplicar especificações do Flow" : imagesOnly ? "Reaplicar imagens do Flow" : "Conferir importação do Flow"}</DialogTitle>
          <DialogDescription>
            {specsOnly
              ? `Nenhuma peça será criada. Localização vem da Demanda; a especificação sugerida só entra em peças de ${campaignName} sem especificação ou com "${DEFAULT_SPECIFICATION}".`
              : imagesOnly
              ? `Nenhuma peça será criada. As imagens vão para as peças já existentes em ${campaignName} com o mesmo nome; imagens enviadas manualmente são mantidas.`
              : `Revise os dados antes de importar para ${campaignName}. Nada será gravado até a confirmação.`}
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
          {!catalog && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando localizações e especificações de outras campanhas do cliente...</span>
          )}
          {importing && specsOnly && <Progress value={progress} className="h-2" aria-label="Atualizando peças" />}
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
                {matchExisting && <TableHead className="w-48">Peça na campanha</TableHead>}
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
                      {f.key === "name" && mode === "create" && isFlowKit(row.piece.sourceName) && (
                        <span className="mt-1 inline-block rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {(() => {
                            const count = parseKitComponents(row.piece.sourceName)?.length ?? 1;
                            return count > 1 ? `KIT — ${count} componentes` : "KIT — 1 componente (complete os demais)";
                          })()}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="p-1.5">
                    <Input
                      aria-label={`Especificação da linha ${index + 1}`}
                      value={row.piece.specification}
                      placeholder={DEFAULT_SPECIFICATION}
                      onChange={(e) => updateField(row.id, "specification", e.target.value)}
                    />
                    {row.specSuggested && <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">sugerida</span>}
                  </TableCell>
                  <TableCell className="p-1.5">{renderImage(row.image)}</TableCell>
                  {matchExisting && (
                    <TableCell className="p-1.5 text-xs">
                      {matches[index]
                        ? <span className="text-foreground">#{matches[index]!.code} {matches[index]!.name}{imagesOnly && !canReplaceImage(matches[index]!.image_url) && <span className="block text-muted-foreground">já tem imagem — mantida</span>}</span>
                        : <span className="text-destructive">não encontrada</span>}
                    </TableCell>
                  )}
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
          <Button type="button" disabled={importing || stillLoading || !catalog || rows.length === 0} onClick={() => void (specsOnly ? handleApplySpecs() : imagesOnly ? handleApplyImages() : handleConfirm())}>
            {importing ? "Enviando..." : !catalog ? "Carregando..." : stillLoading ? "Baixando imagens..." : specsOnly ? "Aplicar especificações" : imagesOnly ? "Aplicar imagens" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
