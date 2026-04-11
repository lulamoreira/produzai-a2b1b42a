import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function InterfaceSettings() {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAgencyId, setPendingAgencyId] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"legacy" | "new">("legacy");
  const [saving, setSaving] = useState(false);

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ["agencies_interface_mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name, interface_mode")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; interface_mode: string }[];
    },
  });

  const handleToggle = (agencyId: string, checked: boolean) => {
    const newMode = checked ? "new" : "legacy";
    setPendingAgencyId(agencyId);
    setPendingMode(newMode);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!pendingAgencyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ interface_mode: pendingMode })
        .eq("id", pendingAgencyId);
      if (error) throw error;
      queryClient.setQueryData(["interface_mode", pendingAgencyId], pendingMode);
      queryClient.invalidateQueries({ queryKey: ["agencies_interface_mode"] });
      queryClient.invalidateQueries({ queryKey: ["interface_mode"] });
      toast.success(
        pendingMode === "new"
          ? "Interface atualizada para a versão Nova!"
          : "Interface restaurada para a versão Clássica."
      );
    } catch {
      toast.error("Erro ao alterar a versão da interface.");
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Versão da Interface</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Alterne entre a interface Clássica e a Nova versão do sistema para cada agência.
        </p>
      </div>

      {agencies.map((agency) => (
        <div key={agency.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card">
          <span className="text-sm font-medium text-foreground flex-1">{agency.name}</span>
          <span className={`text-xs font-medium ${agency.interface_mode === "legacy" ? "text-foreground" : "text-muted-foreground"}`}>
            Clássica
          </span>
          <Switch
            checked={agency.interface_mode === "new"}
            onCheckedChange={(checked) => handleToggle(agency.id, checked)}
          />
          <span className={`text-xs font-medium ${agency.interface_mode === "new" ? "text-foreground" : "text-muted-foreground"}`}>
            Nova
          </span>
        </div>
      ))}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
          <p className="font-medium">Esta configuração afeta todos os usuários da agência selecionada.</p>
          <p>A alternância é instantânea e reversível. Nenhum dado é perdido ao alternar.</p>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de interface</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar a interface para a versão{" "}
              <strong>{pendingMode === "new" ? "Nova" : "Clássica"}</strong>.
              Esta mudança afetará todos os usuários da agência imediatamente.
              Nenhum dado será perdido e a alteração pode ser revertida a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
