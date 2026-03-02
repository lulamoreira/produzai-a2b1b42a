import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const BackupRestorePanel = () => {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { inserted: number; error?: string }> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("backup-restore", {
        method: "GET",
      });

      if (res.error) throw new Error(res.error.message);

      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup baixado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar backup: " + (err.message || "Erro desconhecido"));
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmRestore(true);
    // reset input so same file can be selected again
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setConfirmRestore(false);
    setRestoring(true);
    setLastResult(null);

    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);

      if (!backup.tables) {
        throw new Error("Formato de backup inválido. Esperado campo 'tables'.");
      }

      const { data, error } = await supabase.functions.invoke("backup-restore", {
        method: "POST",
        body: backup,
      });

      if (error) throw new Error(error.message);

      setLastResult(data.results);
      toast.success("Restore concluído!");
    } catch (err: any) {
      toast.error("Erro no restore: " + (err.message || "Erro desconhecido"));
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">Backup & Restore</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Backup */}
        <div className="border border-border rounded-xl p-6 space-y-3 bg-card">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Download className="w-5 h-5 text-primary" />
            Fazer Backup
          </div>
          <p className="text-sm text-muted-foreground">
            Exporta todos os dados do sistema em um arquivo JSON.
          </p>
          <Button onClick={handleBackup} disabled={downloading} className="w-full gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
            Substitui <strong>todos</strong> os dados atuais pelo conteúdo do arquivo de backup.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
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

      {/* Results */}
      {lastResult && (
        <div className="border border-border rounded-xl p-4 bg-card space-y-2">
          <h3 className="font-medium text-foreground text-sm">Resultado do Restore</h3>
          <div className="grid gap-1 text-xs">
            {Object.entries(lastResult).map(([table, info]) => (
              <div key={table} className="flex items-center gap-2">
                {info.error ? (
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                )}
                <span className="font-mono text-muted-foreground">{table}</span>
                <span className="text-foreground">{info.inserted} registros</span>
                {info.error && <span className="text-destructive">{info.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Restauração
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>apagar todos os dados atuais</strong> e substituí-los pelo conteúdo do backup.
              Essa operação é <strong>irreversível</strong>. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
