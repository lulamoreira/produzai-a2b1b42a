import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const NameConfirmDialog = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile_name_confirm", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, name_confirmed")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const needsConfirmation = !isLoading && profile && !profile.name_confirmed;

  const handleConfirm = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), name_confirmed: true })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar nome.");
    } else {
      toast.success("Nome salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["profile_name_confirm"] });
    }
  };

  if (!needsConfirmation) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bem-vindo! 👋</DialogTitle>
          <DialogDescription>
            Como você quer ser chamado na plataforma?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={profile?.display_name || "Ex: João, Maria..."}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </div>
          <Button className="w-full" onClick={handleConfirm} disabled={!name.trim() || saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
