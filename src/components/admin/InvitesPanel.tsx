import React, { useEffect } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissionCategories } from "@/hooks/usePermissionCategories";

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
    },
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Realtime: refresh the panel the moment any invite is accepted/changed
  useEffect(() => {
    const channel = supabase
      .channel('invites-panel-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invites' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invites'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: categories = [] } = usePermissionCategories();
  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["all-campaigns-list-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name");
      if (error) throw error;
      return data || [];
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-semibold text-stone-900">{t("invite.panelTitle")}</h2>
        <div className="flex flex-wrap items-center gap-2">
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
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {invites.map((invite: any) => {
              const isPending = !invite.used_at && new Date(invite.expires_at) > new Date();
              return (
                <div key={invite.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-900 truncate">{invite.name}</div>
                      <div className="text-stone-400 text-xs truncate">{invite.email}</div>
                    </div>
                    {getStatusBadge(invite)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {getRoleBadge(invite.role)}
                    {invite.agency?.name && (
                      <span className="text-stone-500 truncate">{invite.agency.name}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Enviado: {formatters.dateShort(invite.created_at)}</span>
                    <span>Válido até: {formatters.dateShort(invite.expires_at)}</span>
                  </div>
                  {isPending && (
                    <div className="space-y-2 pt-2 border-t border-stone-100">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Link do convite</div>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={`${window.location.origin}/join/${invite.token}`}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 text-[11px] bg-stone-50 border border-stone-200 rounded-md px-2 py-1.5 text-stone-700 font-mono truncate"
                        />
                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(invite.token)} className="h-8 px-2 shrink-0">
                          <Copy size={14} className="mr-1" /> Copiar
                        </Button>
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleResend(invite)} className="h-9 w-9 text-stone-500" title={t("invite.resend")}>
                          <RefreshCcw size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleCancel(invite.id)} className="h-9 w-9 text-red-500" title={t("invite.cancel")}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Desktop / tablet: table */}
          <div className="hidden md:block bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
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
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-stone-50 text-stone-600 border-stone-200 text-[10px] cursor-help">
                                {t("invite.campaignAccess.campaigns", { count: invite.permissions.length })}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border border-stone-200 shadow-lg p-3 rounded-lg w-64">
                              <div className="space-y-2">
                                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Acessos Pré-configurados</p>
                                {invite.permissions.map((p: any, i: number) => {
                                  const campaign = allCampaigns.find(c => c.id === p.campaign_id);
                                  const category = categories.find(cat => cat.id === p.category_id);
                                  return (
                                    <div key={i} className="flex flex-col border-b border-stone-100 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0">
                                      <span className="text-[11px] font-semibold text-stone-900 truncate">{campaign?.name || p.campaign_id}</span>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-stone-500">{category?.name || "—"}</span>
                                        {p.suspended && <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded uppercase font-bold">Inativo</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
          </div>
        </>
      )}
    </div>
  );
}