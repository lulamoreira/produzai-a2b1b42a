import { useState, useRef } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload, AlertTriangle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  campaignName: string;
}

type Stage = "idle" | "fetching" | "downloading" | "zipping" | "done" | "extracting" | "uploading" | "restoring";

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/campaign-backup`;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? ""}`,
    "Content-Type": "application/json",
  };
}

// Run promises with limited concurrency
async function pMap<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>, concurrency = 5): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export default function CampaignBackupDialog({ open, onOpenChange, campaignId, campaignName }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  // Restore state
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [results, setResults] = useState<Record<string, any> | null>(null);

  const busy = stage !== "idle" && stage !== "done";

  // ────────── BACKUP ──────────
  const handleBackup = async () => {
    setStage("fetching");
    setProgress(5);
    setProgressLabel("Coletando dados…");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_URL}?campaign_id=${campaignId}`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      const payload = await res.json();
      const { manifest, tables, storage_files } = payload;

      const zip = new JSZip();
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("data.json", JSON.stringify({ tables }, null, 2));

      // Download photos in parallel
      const total = storage_files.length;
      let done = 0;
      setStage("downloading");
      setProgressLabel(`Baixando fotos (0/${total})…`);

      await pMap(storage_files, async (f: any) => {
        if (!f.signed_url) return;
        try {
          const r = await fetch(f.signed_url);
          if (r.ok) {
            const blob = await r.blob();
            zip.file(`storage/${f.bucket}/${f.path}`, blob);
          }
        } catch (e) {
          console.warn("download failed", f.path, e);
        }
        done++;
        setProgress(10 + Math.round((done / Math.max(total, 1)) * 75));
        setProgressLabel(`Baixando fotos (${done}/${total})…`);
      }, 5);

      setStage("zipping");
      setProgress(90);
      setProgressLabel("Compactando…");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

      const filename = `campaign-backup-${slugify(campaignName)}-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setProgress(100);
      setProgressLabel("Pronto!");
      setStage("done");
      toast.success("Backup baixado com sucesso");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
      setStage("idle");
      setProgress(0);
    }
  };

  // ────────── RESTORE ──────────
  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setConfirmText("");
    setConfirmOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setStage("extracting");
    setProgress(5);
    setProgressLabel("Extraindo arquivo…");
    setResults(null);
    try {
      const zip = await JSZip.loadAsync(pendingFile);
      const dataFile = zip.file("data.json");
      if (!dataFile) throw new Error("data.json não encontrado no ZIP");
      const data = JSON.parse(await dataFile.async("string"));
      const tables = data.tables;

      // Collect storage files in zip
      const storageEntries: { bucket: string; path: string; file: JSZip.JSZipObject }[] = [];
      zip.folder("storage")?.forEach((relPath, file) => {
        if (file.dir) return;
        const slash = relPath.indexOf("/");
        if (slash <= 0) return;
        const bucket = relPath.slice(0, slash);
        const path = relPath.slice(slash + 1);
        storageEntries.push({ bucket, path, file });
      });

      // Upload binaries via signed upload URLs
      setStage("uploading");
      const total = storageEntries.length;
      let done = 0;
      setProgressLabel(`Reenviando fotos (0/${total})…`);
      const headers = await authHeaders();

      await pMap(storageEntries, async (entry) => {
        try {
          const urlRes = await fetch(
            `${FN_URL}?action=upload-url&bucket=${encodeURIComponent(entry.bucket)}&path=${encodeURIComponent(entry.path)}&campaign_id=${campaignId}`,
            { headers }
          );
          if (!urlRes.ok) throw new Error("signed url falhou");
          const { signed_url } = await urlRes.json();
          const blob = await entry.file.async("blob");
          await fetch(signed_url, { method: "PUT", body: blob });
        } catch (e) {
          console.warn("upload failed", entry.path, e);
        }
        done++;
        setProgress(10 + Math.round((done / Math.max(total, 1)) * 60));
        setProgressLabel(`Reenviando fotos (${done}/${total})…`);
      }, 5);

      // Send tables to restore
      setStage("restoring");
      setProgress(80);
      setProgressLabel("Restaurando registros…");
      const restoreRes = await fetch(FN_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ campaign_id: campaignId, tables }),
      });
      const result = await restoreRes.json();
      if (!restoreRes.ok) throw new Error(result.error || "Erro restore");

      setResults(result.results);
      setProgress(100);
      setProgressLabel("Restauração concluída");
      setStage("done");
      toast.success("Restauração concluída");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
      setStage("idle");
      setProgress(0);
    } finally {
      setPendingFile(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Backup da Campanha
            </DialogTitle>
            <DialogDescription>
              Baixe ou restaure todos os dados e fotos desta campanha em um único arquivo ZIP.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            {/* BACKUP */}
            <div className="border border-border rounded-xl p-5 space-y-3 bg-card">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Download className="w-5 h-5 text-primary" /> Baixar Backup
              </div>
              <p className="text-sm text-muted-foreground">
                Exporta todos os dados da campanha + binários do storage em um arquivo ZIP.
              </p>
              <Button onClick={handleBackup} disabled={busy} className="w-full gap-2">
                {stage === "fetching" || stage === "downloading" || stage === "zipping" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar
              </Button>
            </div>

            {/* RESTORE */}
            <div className="border border-border rounded-xl p-5 space-y-3 bg-card">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Upload className="w-5 h-5 text-destructive" /> Restaurar Backup
              </div>
              <p className="text-sm text-muted-foreground">
                Substitui <strong>todos os dados desta campanha</strong> pelo conteúdo do ZIP. Irreversível.
              </p>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onFilePicked} />
              <Button
                variant="destructive"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full gap-2"
              >
                {stage === "extracting" || stage === "uploading" || stage === "restoring" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Selecionar ZIP
              </Button>
            </div>
          </div>

          {(busy || stage === "done") && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {results && (
            <div className="border border-border rounded-lg p-3 bg-muted/40 max-h-60 overflow-auto text-xs space-y-1 mt-2">
              <div className="font-medium text-foreground mb-1">Resultado por tabela</div>
              {Object.entries(results).map(([tbl, info]: any) => (
                <div key={tbl} className="flex items-center gap-2">
                  {info.error
                    ? <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                    : <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className="font-mono text-muted-foreground">{tbl}</span>
                  <span className="text-foreground">{info.inserted} inseridos</span>
                  {info.error && <span className="text-destructive truncate">{info.error}</span>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Double confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Confirmar restauração
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta ação irá <strong>apagar todos os dados atuais desta campanha</strong> e
                  substituí-los pelo conteúdo do backup. <strong>Operação irreversível.</strong>
                </p>
                <p className="text-sm">
                  Para confirmar, digite o nome da campanha: <code className="font-mono text-foreground">{campaignName}</code>
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={campaignName}
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingFile(null); setConfirmText(""); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== campaignName.trim()}
              onClick={handleRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
