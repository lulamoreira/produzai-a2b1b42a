import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayName } from "@/components/AppHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Check, Megaphone, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePermissionCategories } from "@/hooks/usePermissionCategories";

const ROLES = [
  { value: "viewer", labelKey: "invite.roles.viewer" },
  { value: "editor", labelKey: "invite.roles.editor" },
  { value: "manager", labelKey: "invite.roles.manager" },
  { value: "master", labelKey: "invite.roles.master" },
  { value: "admin", labelKey: "invite.roles.admin" },
];

const CAMPAIGN_ROLES = [
  "Admin",
  "Atendimento Agência",
  "Cliente",
  "Editor",
  "Equipe de Instalação",
  "Master",
  "Tratativa de Ocorrências",
  "Visualizador"
];

const VALIDITY_OPTIONS = [
  { value: "7", labelKey: "invite.form.days7" },
  { value: "15", labelKey: "invite.form.days15" },
  { value: "30", labelKey: "invite.form.days30" },
];

export function InviteForm() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { displayName } = useDisplayName();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "viewer",
    agency_id: "none",
    personal_message: "",
    validity: "15"
  });

  const [campaignAccess, setCampaignAccess] = useState<any[]>([]);

  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["all-campaigns-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(name, agency_id, agencies(name))")
        .order("name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: categories = [] } = usePermissionCategories();

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success(t("invite.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(formData.validity));

      const { data: invite, error } = await supabase
        .from("invites")
        .insert({
          email: formData.email,
          name: formData.name,
          role: formData.role,
          agency_id: formData.agency_id === "none" ? null : formData.agency_id,
          personal_message: formData.personal_message,
          invited_by: user?.id,
          invited_by_name: displayName,
          expires_at: expiresAt.toISOString(),
          permissions: campaignAccess
        })
        .select()
        .single();

      if (error) throw error;

      const joinUrl = `${window.location.origin}/join/${invite.token}`;
      setInviteUrl(joinUrl);

      const subject = encodeURIComponent(`Você foi convidado para o ProduzAI`);
      const expiryDateFormatted = format(new Date(invite.expires_at), 'dd/MM/yyyy', { locale: ptBR });
      
      const body = encodeURIComponent(
        `Olá, ${invite.name}!\n\n` +
        `${invite.personal_message ? invite.personal_message + '\n\n' : ''}` +
        `Você foi convidado por ${displayName} para acessar o ProduzAI — plataforma de gestão de campanhas PDV.\n\n` +
        `Para criar sua conta, clique no link abaixo:\n${joinUrl}\n\n` +
        `Passos simples:\n` +
        `1. Clique no link acima\n` +
        `2. Confirme seu nome e escolha uma senha\n` +
        `3. Pronto — seu acesso já estará configurado!\n\n` +
        `Convite válido até: ${expiryDateFormatted}\n\n` +
        `Qualquer dúvida, responda este email.`
      );

      window.open(`mailto:${invite.email}?subject=${subject}&body=${body}`);
      
      toast.success(t("invite.sent"));
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      
    } catch (err: any) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "viewer",
      agency_id: "none",
      personal_message: "",
      validity: "15"
    });
    setCampaignAccess([]);
    setInviteUrl(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) resetForm();
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button className="bg-[#C2714F] hover:bg-[#b06040] text-white gap-2">
          <Plus size={18} />
          {t("invite.newInvite")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Convite</DialogTitle>
        </DialogHeader>
        <DialogHeader>
          <DialogTitle>Novo Convite</DialogTitle>
        </DialogHeader>

        {inviteUrl ? (
          <div className="py-6 space-y-6">
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 space-y-2">
              <Label className="text-xs text-stone-400 uppercase font-bold tracking-wider">Link do Convite</Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} className="bg-white border-stone-200" />
                <Button variant="outline" size="icon" onClick={handleCopyLink} className="shrink-0">
                  {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-stone-500 text-center">
              O cliente de e-mail foi aberto com os dados do convite. <br />
              Caso não tenha aberto, copie o link acima e envie manualmente.
            </p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input 
                id="name"
                required 
                placeholder={t("invite.form.namePlaceholder")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                required 
                placeholder="email@empresa.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Papel (Role)</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {t(role.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agência</Label>
              <Select 
                value={formData.agency_id} 
                onValueChange={(v) => setFormData({ ...formData, agency_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("invite.form.selectAgency")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("invite.form.selectAgency")}</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mensagem pessoal</Label>
              <Textarea 
                rows={3}
                placeholder={t("invite.form.messagePlaceholder")}
                value={formData.personal_message}
                onChange={(e) => setFormData({ ...formData, personal_message: e.target.value })}
              />
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-primary" />
                <h4 className="text-sm font-semibold text-foreground">{t("invite.campaignAccess.title")}</h4>
                <Badge variant="outline" className="bg-stone-100 text-stone-500 text-[10px] rounded-full border-none">
                  {t("invite.campaignAccess.badge")}
                </Badge>
              </div>

              {campaignAccess.length > 0 ? (
                <div className="space-y-3">
                  {campaignAccess.map((access, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-stone-50/50">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={access.campaign_id} 
                          onValueChange={(val) => {
                            const newAccess = [...campaignAccess];
                            newAccess[index].campaign_id = val;
                            setCampaignAccess(newAccess);
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs flex-1">
                            <SelectValue placeholder={t("invite.campaignAccess.selectCampaign")} />
                          </SelectTrigger>
                          <SelectContent>
                            {allCampaigns.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.clients?.agencies?.name} / {c.clients?.name} / {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => setCampaignAccess(campaignAccess.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Select 
                          value={access.category_id || ""} 
                          onValueChange={(val) => {
                            const newAccess = [...campaignAccess];
                            newAccess[index].category_id = val;
                            setCampaignAccess(newAccess);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px] flex-1">
                            <SelectValue placeholder="Papel / Categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-[10px] font-medium text-stone-500">
                            {access.suspended ? t("invite.campaignAccess.inactive") : t("invite.campaignAccess.active")}
                          </span>
                          <Switch 
                            checked={!access.suspended} 
                            onCheckedChange={(checked) => {
                              const newAccess = [...campaignAccess];
                              newAccess[index].suspended = !checked;
                              setCampaignAccess(newAccess);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-stone-400 italic">
                  {t("invite.campaignAccess.noCampaigns")}
                </p>
              )}

              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="text-xs text-primary h-8 gap-1.5"
                onClick={() => setCampaignAccess([...campaignAccess, { campaign_id: "", category_id: categories[0]?.id || "", suspended: false }])}
              >
                <Plus size={14} /> {t("invite.campaignAccess.addCampaign")}
              </Button>
            </div>

            <div className="space-y-2 pt-2">
              <Label>{t("invite.form.validity")}</Label>
              <Select 
                value={formData.validity} 
                onValueChange={(v) => setFormData({ ...formData, validity: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button 
                type="submit" 
                className="bg-[#C2714F] hover:bg-[#b06040] text-white"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("invite.send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}