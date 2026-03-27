import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile_full", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, job_title, nickname")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && open,
  });

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    job_title: "",
    nickname: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        phone: (profile as any).phone || "",
        job_title: (profile as any).job_title || "",
        nickname: (profile as any).nickname || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = form.display_name.trim();
    if (!trimmedName) {
      toast.error("O nome completo é obrigatório.");
      return;
    }
    if (trimmedName.length > 100) {
      toast.error("O nome deve ter no máximo 100 caracteres.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: trimmedName,
        phone: form.phone.trim() || null,
        job_title: form.job_title.trim() || null,
        nickname: form.nickname.trim() || null,
      } as any)
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar perfil.");
      return;
    }

    toast.success("Perfil atualizado com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["profile_display"] });
    queryClient.invalidateQueries({ queryKey: ["profile_full"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>Atualize seus dados pessoais.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>

            <div>
              <Label className="text-xs">Nome Completo *</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Seu nome completo"
                maxLength={100}
              />
            </div>

            <div>
              <Label className="text-xs">Apelido</Label>
              <Input
                value={form.nickname}
                onChange={(e) => setForm(f => ({ ...f, nickname: e.target.value }))}
                placeholder="Como prefere ser chamado"
                maxLength={50}
              />
            </div>

            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
                maxLength={20}
              />
            </div>

            <div>
              <Label className="text-xs">Cargo</Label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm(f => ({ ...f, job_title: e.target.value }))}
                placeholder="Ex: Gerente de Projetos"
                maxLength={80}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
