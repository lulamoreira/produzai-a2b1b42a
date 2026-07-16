import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Download, Upload, AlertTriangle, CheckCircle2, Loader2, Clock,
  Database, FileArchive, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BackupRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  trigger: "manual" | "scheduled";
  storage_path: string | null;
  size_bytes: number | null;
  tables_count: number | null;
  files_count: number | null;
  error_message: string | null;
}

interface RestoreReport {
  tables: Record<string, { upserted: number; skipped: number; error?: string }>;
  storage: Record<string, { uploaded: number; skipped: number; error?: string }>;
}

const formatBytes = (b: number | null): string => {
  if (!b) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
};

export const BackupRestorePanel = () => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [includeStorage, setIncludeStorage] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRuns = async () => {
    setLoadingRuns(true);
    // Sweep stale "running" rows (>10 min abandoned) so the history doesn't lie.
    const { error: sweepError } = await supabase.rpc("mark_stale_backup_runs_admin");
    if (sweepError) {
      toast.error(`Erro ao limpar execuções travadas: ${sweepError.message}`);
    }
    const { data } = await supabase
      .from("system_backup_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setRuns((data ?? []) as BackupRun[]);
    setLoadingRuns(false);
  };


  useEffect(() => { loadRuns(); }, []);

  const handleBackupNow = async () => {
    setDownloading(true);
    try {
      // Clear any zombie "running" rows before starting (also unblocks rate limit).
      // Clear any zombie "running" rows before starting (also unblocks rate limit).
      const { error: sweepError } = await supabase.rpc("mark_stale_backup_runs_admin");
      if (sweepError) {
        toast.error(`Erro ao limpar execuções travadas: ${sweepError.message}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-restore?storage=${includeStorage}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success("Backup gerado com sucesso");
      loadRuns();
    } catch (err) {
      toast.error(`Erro ao gerar backup: ${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadStored = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("system-backups").download(path);
      if (error || !data) throw error ?? new Error("Arquivo não encontrado");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() ?? "backup.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Erro ao baixar: ${(err as Error).message}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmRestore(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setConfirmRestore(false);
    setRestoring(true);
    setReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const buf = await pendingFile.arrayBuffer();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-restore`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/zip",
          },
          body: buf,
        },
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReport(json.report);
      toast.success("Restauração concluída (mesclagem por id)");
    } catch (err) {
      toast.error(`Erro ao restaurar: ${(err as Error).message}`);
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Backup &amp; Restore</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Snapshot completo do banco (todas as tabelas) e arquivos do Storage. Backup automático diário às 03h (horário de Brasília), com retenção de 7 dias + 4 semanas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Backup */}
        <div className="border border-border rounded-xl p-6 space-y-3 bg-card">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Download className="w-5 h-5 text-primary" />
            Fazer Backup Agora
          </div>
          <p className="text-sm text-muted-foreground">
            Gera um arquivo ZIP com todas as tabelas e (opcionalmente) os arquivos do Storage.
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox
              checked={includeStorage}
              onCheckedChange={(v) => setIncludeStorage(v === true)}
            />
            Incluir arquivos do Storage (fotos, anexos) — mais lento
          </label>
          <Button onClick={handleBackupNow} disabled={downloading} className="w-full gap-2">
            {downloading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            {downloading ? "Gerando..." : "Baixar Backup"}
          </Button>
        </div>

        {/* Restore */}
        <div className="border border-border rounded-xl p-6 space-y-3 bg-card">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Upload className="w-5 h-5 text-destructive" />
            Restaurar Backup
          </div>
          <p className="text-sm text-muted-foreground">
            Mescla os dados do arquivo com o banco atual (<strong>upsert por id</strong>). Registros existentes são atualizados, novos são inseridos. <strong>Nada é apagado.</strong>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="destructive"
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="w-full gap-2"
          >
            {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restoring ? "Restaurando..." : "Selecionar Arquivo"}
          </Button>
        </div>
      </div>

      {/* Backup history */}
      <div className="border border-border rounded-xl bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-foreground font-medium text-sm">
            <Database className="w-4 h-4 text-primary" />
            Histórico de Backups
          </div>
          <Button variant="ghost" size="sm" onClick={loadRuns} className="h-7 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRuns ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <div className="divide-y divide-border">
          {loadingRuns && runs.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          )}
          {!loadingRuns && runs.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum backup ainda. O primeiro será gerado automaticamente à 03h.
            </div>
          )}
          {runs.map((run) => (
            <div key={run.id} className="px-4 py-3 grid grid-cols-12 items-center gap-2 text-sm">
              <div className="col-span-3 flex items-center gap-2 text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {format(new Date(run.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              <div className="col-span-2">
                <Badge
                  variant="outline"
                  className={
                    run.trigger === "scheduled"
                      ? "border-blue-200 text-blue-700 bg-blue-50"
                      : "border-stone-200 text-stone-700 bg-stone-50"
                  }
                >
                  {run.trigger === "scheduled" ? "Automático" : "Manual"}
                </Badge>
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                {run.status === "success" && (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Sucesso</span></>
                )}
                {run.status === "running" && (
                  <><Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    <span className="text-blue-700">Em andamento</span></>
                )}
                {run.status === "error" && (
                  <><AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-destructive" title={run.error_message ?? ""}>Erro</span></>
                )}
              </div>
              <div className="col-span-2 text-muted-foreground text-xs">
                {run.tables_count ?? 0} tabelas · {run.files_count ?? 0} arquivos
              </div>
              <div className="col-span-1 text-right text-xs text-muted-foreground">
                {formatBytes(run.size_bytes)}
              </div>
              <div className="col-span-2 text-right">
                {run.storage_path && run.status === "success" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={() => handleDownloadStored(run.storage_path!)}
                  >
                    <FileArchive className="w-3.5 h-3.5" />
                    Baixar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restore report */}
      {report && (
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <h3 className="font-medium text-foreground text-sm">Resultado da Restauração</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tabelas</p>
              <div className="grid gap-0.5 text-xs max-h-64 overflow-y-auto pr-2">
                {Object.entries(report.tables).map(([table, info]) => (
                  <div key={table} className="flex items-center gap-2">
                    {info.error
                      ? <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                      : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    <span className="font-mono text-muted-foreground truncate">{table}</span>
                    <span className="text-foreground ml-auto">{info.upserted}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Storage</p>
              <div className="grid gap-0.5 text-xs max-h-64 overflow-y-auto pr-2">
                {Object.entries(report.storage).map(([bucket, info]) => (
                  <div key={bucket} className="flex items-center gap-2">
                    {info.error
                      ? <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                      : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    <span className="font-mono text-muted-foreground truncate">{bucket}</span>
                    <span className="text-foreground ml-auto">{info.uploaded}</span>
                  </div>
                ))}
                {Object.keys(report.storage).length === 0 && (
                  <p className="text-muted-foreground">Backup sem arquivos.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm restore dialog */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Restauração
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta restauração faz <strong>upsert por id</strong>: linhas existentes são atualizadas e novas são inseridas. <strong>Nada é apagado.</strong>
              </span>
              <span className="block text-xs text-muted-foreground">
                Arquivo: {pendingFile?.name} ({formatBytes(pendingFile?.size ?? 0)})
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Restaurar (mesclar)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
