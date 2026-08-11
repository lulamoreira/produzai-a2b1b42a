import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RevertImportButtonProps {
  clientId: string;
}

export function RevertImportButton({ clientId }: RevertImportButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reverting, setReverting] = useState(false);

  const { data: latestBatch, isLoading, refetch } = useQuery({
    queryKey: ["latest_store_import_batch", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_import_batches" as any)
        .select("*")
        .eq("client_id", clientId)
        .is("reverted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
  });

  const handleRevert = async () => {
    if (!latestBatch) return;
    setReverting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("revert_store_import", {
        _batch_id: latestBatch.id,
      });

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast.success(
          `Importação revertida! Restauradas ${result.restored_updated} lojas, ${result.reactivated} reativadas, ${result.deleted} excluídas e ${result.deactivated_created} inativadas.`
        );
        queryClient.invalidateQueries({ queryKey: ["client-stores"] });
        queryClient.invalidateQueries({ queryKey: ["latest_store_import_batch"] });
        refetch();
      } else {
        toast.error(result.message || "Erro ao reverter importação.");
      }
    } catch (err: any) {
      console.error("Error reverting import:", err);
      toast.error("Erro técnico ao reverter importação.");
    } finally {
      setReverting(false);
    }
  };

  if (isLoading) return null;

  if (!latestBatch) {
    return (
      <Button variant="outline" size="sm" className="gap-1 text-xs opacity-50 cursor-not-allowed" disabled>
        <RefreshCw className="w-3.5 h-3.5" /> Reverter última importação
      </Button>
    );
  }

  const dateStr = format(new Date(latestBatch.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const summary = `${latestBatch.file_name || "Planilha"} (${dateStr}): ${latestBatch.added_count} criadas, ${latestBatch.updated_count} atualizadas, ${latestBatch.deactivated_count} desativadas.`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs border-amber-200 hover:bg-amber-50 text-amber-700">
          <RefreshCw className={reverting ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} /> 
          Reverter última importação
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Confirmar Reversão
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>Você está prestes a desfazer a importação realizada em <strong>{dateStr}</strong>.</p>
            <div className="bg-muted p-3 rounded-md text-xs font-mono">
              {summary}
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Lojas <strong>criadas</strong> serão excluídas (ou desativadas se já possuírem dados em campanhas).</li>
              <li>Lojas <strong>atualizadas</strong> voltarão exatamente ao estado anterior.</li>
              <li>Lojas que foram <strong>desativadas</strong> na importação serão reativadas.</li>
            </ul>
            <p className="font-semibold text-destructive">Esta ação é irreversível.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleRevert} 
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={reverting}
          >
            {reverting ? "Revertendo..." : "Sim, Reverter"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
