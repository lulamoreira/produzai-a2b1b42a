import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Copy, 
  Trash2, 
  RefreshCcw, 
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./InviteForm";
import { BatchInviteForm } from "./BatchInviteForm";
import { useFormatters } from "@/lib/formatters";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function InvitesPanel() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('*, agency:agencies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">{role.toUpperCase()}</Badge>;
      case 'master':
        return <Badge className="bg-[#FDF0EB] text-[#C2714F] hover:bg-[#FDF0EB] border-none">{role.toUpperCase()}</Badge>;
      case 'manager':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">{role.toUpperCase()}</Badge>;
      case 'editor':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">{role.toUpperCase()}</Badge>;
      default:
        return <Badge className="bg-stone-100 text-stone-600 hover:bg-stone-100 border-none">{role.toUpperCase()}</Badge>;
    }
  };

  const getStatusBadge = (invite: any) => {
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);

    if (invite.used_at) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none gap-1">
          <CheckCircle2 size={12} /> {t("invite.status.accepted")}
        </Badge>
      );
    }

    if (expiresAt <= now) {
      return (
        <Badge className="bg-red-100 text-red-600 hover:bg-red-100 border-none gap-1">
          <AlertCircle size={12} /> {t("invite.status.expired")}
        </Badge>
      );
    }

    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none gap-1">
        <Clock size={12} /> {t("invite.status.pending")}
      </Badge>
    );
  };

  const handleResend = (invite: any) => {
    const joinUrl = `${window.location.origin}/join/${invite.token}`;
    const subject = encodeURIComponent(`Reenvio: Convite para o ProduzAI`);
    const expiryDateFormatted = format(new Date(invite.expires_at), 'dd/MM/yyyy', { locale: ptBR });
    
    const body = encodeURIComponent(
      `Olá, ${invite.name}!\n\n` +
      `${invite.personal_message ? invite.personal_message + '\n\n' : ''}` +
      `Estamos reenviando seu convite para acessar o ProduzAI — plataforma de gestão de campanhas PDV.\n\n` +
      `Para criar sua conta, clique no link abaixo:\n${joinUrl}\n\n` +
      `Convite válido até: ${expiryDateFormatted}\n\n` +
      `Qualquer dúvida, responda este email.`
    );

    window.open(`mailto:${invite.email}?subject=${subject}&body=${body}`);
    toast.success(t("invite.sent"));
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(t("invite.linkCopied"));
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(t("invite.confirmCancel"))) return;

    try {
      const { error } = await supabase
        .from('invites')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(t("common.success"));
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-900">{t("invite.panelTitle")}</h2>
        <div className="flex items-center gap-2">
          <InviteForm />
          <BatchInviteForm />
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 mt-8">
          <Mail size={48} className="text-stone-300 mb-4" />
          <h3 className="text-stone-600 font-medium">{t("invite.empty")}</h3>
          <p className="text-stone-400 text-sm mt-1 mb-6">{t("invite.emptyHint")}</p>
          <InviteForm />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Convidado</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Papel</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider text-center">Agência</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Campanhas</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Enviado em</th>
                <th className="px-4 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Válido até</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invites.map((invite: any) => {
                const isPending = !invite.used_at && new Date(invite.expires_at) > new Date();
                return (
                  <tr key={invite.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-stone-900">{invite.name}</div>
                      <div className="text-stone-400 text-sm">{invite.email}</div>
                    </td>
                    <td className="px-4 py-4">{getRoleBadge(invite.role)}</td>
                    <td className="px-4 py-4 text-stone-400 text-sm text-center">
                      {invite.agency?.name || "—"}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(invite)}</td>
                    <td className="px-4 py-4">
                      {invite.permissions && Array.isArray(invite.permissions) && invite.permissions.length > 0 ? (
                        <Badge variant="outline" className="bg-stone-50 text-stone-600 border-stone-200 text-[10px]">
                          {t("invite.campaignAccess.campaigns", { count: invite.permissions.length })}
                        </Badge>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-stone-500 text-sm">
                      {formatters.dateShort(invite.created_at)}
                    </td>
                    <td className="px-4 py-4 text-stone-500 text-sm">
                      {formatters.dateShort(invite.expires_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isPending && (
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleResend(invite)}
                            title={t("invite.resend")}
                            className="h-8 w-8 text-stone-400 hover:text-[#C2714F]"
                          >
                            <RefreshCcw size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleCopyLink(invite.token)}
                            title={t("invite.copyLink")}
                            className="h-8 w-8 text-stone-400 hover:text-stone-900"
                          >
                            <Copy size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleCancel(invite.id)}
                            title={t("invite.cancel")}
                            className="h-8 w-8 text-stone-400 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}