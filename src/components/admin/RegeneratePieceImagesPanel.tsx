/**
 * Admin tool: Regenerate Piece Image Variants
 * ============================================
 * Scans all pieces (master `pieces` table + `campaign_pieces`) that already have
 * an `image_url` but are missing the optimized variants (`image_report_url`),
 * then for each one:
 *
 *   1. Downloads the original image (browser fetch).
 *   2. Generates the 3 optimized 1:1 variants (thumb / report / full).
 *   3. Uploads them under `variants/{hash}/...` (auto-dedupes).
 *   4. Updates the row with the new variant URLs + content hash.
 *
 * Runs entirely client-side, in batches of 10, with live progress + cancel.
 * Safe to re-run: idempotent (same input bytes → same hash → same paths).
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ImageIcon, Loader2, Square, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadPieceImageVariants } from "@/lib/uploadPieceImage";
import { toast } from "sonner";

type PendingRow = {
  table: "pieces" | "campaign_pieces";
  id: string | number;
  image_url: string;
};

const BATCH_SIZE = 10;

const RegeneratePieceImagesPanel = () => {
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const cancelRef = useRef(false);

  const scan = async () => {
    setScanning(true);
    setPending([]);
    setDone(0);
    setFailed(0);
    setErrors([]);
    try {
      const rows: PendingRow[] = [];
      // Master pieces — only those with image_url but no report variant
      const { data: m, error: mErr } = await supabase
        .from("pieces")
        .select("id, image_url")
        .not("image_url", "is", null)
        .is("image_report_url", null);
      if (mErr) throw mErr;
      (m || []).forEach((p: any) => {
        if (p.image_url) rows.push({ table: "pieces", id: p.id, image_url: p.image_url });
      });
      // Campaign pieces
      const { data: c, error: cErr } = await supabase
        .from("campaign_pieces")
        .select("id, image_url")
        .not("image_url", "is", null)
        .is("image_report_url", null);
      if (cErr) throw cErr;
      (c || []).forEach((p: any) => {
        if (p.image_url) rows.push({ table: "campaign_pieces", id: p.id, image_url: p.image_url });
      });
      setPending(rows);
      toast.success(`${rows.length} imagens encontradas para reprocessar.`);
    } catch (e: any) {
      toast.error("Erro ao escanear: " + e.message);
    } finally {
      setScanning(false);
    }
  };

  const processOne = async (row: PendingRow) => {
    // Fetch original
    const res = await fetch(row.image_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob.size === 0) throw new Error("Empty blob");
    const uploaded = await uploadPieceImageVariants(blob);
    const { error } = await supabase
      .from(row.table)
      .update({
        image_url: uploaded.image_url,
        image_thumb_url: uploaded.image_thumb_url,
        image_report_url: uploaded.image_report_url,
        image_full_url: uploaded.image_full_url,
        image_hash: uploaded.image_hash,
      })
      .eq("id", row.id as any);
    if (error) throw error;
  };

  const run = async () => {
    if (pending.length === 0) return;
    setRunning(true);
    cancelRef.current = false;
    setDone(0);
    setFailed(0);
    setErrors([]);
    try {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        if (cancelRef.current) break;
        const slice = pending.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(slice.map(processOne));
        let okCount = 0;
        let failCount = 0;
        const newErrors: string[] = [];
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") okCount++;
          else {
            failCount++;
            newErrors.push(`${slice[idx].table}#${slice[idx].id}: ${r.reason?.message || r.reason}`);
          }
        });
        setDone((d) => d + okCount);
        setFailed((f) => f + failCount);
        if (newErrors.length) setErrors((prev) => [...prev, ...newErrors].slice(0, 50));
      }
      toast.success("Reprocessamento concluído.");
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const total = pending.length;
  const processed = done + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-4 p-6 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3">
        <ImageIcon className="w-5 h-5 text-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="font-display font-semibold text-foreground">Regenerar imagens das peças</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Reprocessa as imagens antigas das peças, gerando 3 versões otimizadas (lista, relatório e zoom)
            em proporção 1:1 com fundo branco. As versões novas são usadas automaticamente em todos os relatórios e exportações,
            tornando os arquivos muito mais leves e a geração mais rápida.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={scan} disabled={scanning || running} variant="outline" size="sm" className="gap-1.5">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
          {scanning ? "Escaneando..." : "Escanear pendentes"}
        </Button>
        <Button onClick={run} disabled={running || pending.length === 0} size="sm" className="gap-1.5">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {running ? "Processando..." : `Processar ${pending.length || ""} imagens`}
        </Button>
        {running && (
          <Button onClick={() => (cancelRef.current = true)} variant="ghost" size="sm">
            Cancelar
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <Progress value={pct} className="h-2" />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {done} concluídas
            </span>
            {failed > 0 && (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {failed} falharam
              </span>
            )}
            <span>{processed} / {total} ({pct}%)</span>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Detalhes dos erros ({errors.length})
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
            {errors.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
};

export default RegeneratePieceImagesPanel;
