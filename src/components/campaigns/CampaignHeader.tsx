import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Database, Layers, PauseCircle, PlayCircle, AlertTriangle, PowerOff, ExternalLink, Info, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import ExportReportDropdown from "@/components/ExportReportDropdown";
import ExportAllPhotosDialog from "@/components/ExportAllPhotosDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CampaignHeaderProps {
  campaign: any;
  agency: any;
  client: any;
  isAdminOrMaster: boolean;
  canEditCampaign: boolean;
  activeAdjustment?: any;
  onRename: () => void;
  onBackup: () => void;
  onOpenSection: (section: string) => void;
  activeSection?: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
}

export function CampaignHeader({
  campaign,
  agency,
  client,
  isAdminOrMaster,
  canEditCampaign,
  activeAdjustment,
  onRename,
  onBackup,
  onOpenSection,
  activeSection,
  pieces,
  kits,
  kitPieces
}: CampaignHeaderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { agencyId, clientId } = useParams();

  // Query to check for renegotiations
  const { data: latestRenegotiation } = useQuery({
    queryKey: ["campaign-renegotiations", campaign.id],
    queryFn: async () => {
      const rootId = campaign.root_campaign_id || campaign.id;
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, created_at, origin_label")
        .eq("root_campaign_id", rootId)
        .neq("id", campaign.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaign.id,
  });

  const isRenegotiation = !!campaign.origin_label;

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isRenegotiationAlertOpen, setIsRenegotiationAlertOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleCreateRenegotiation = async () => {
    try {
      setIsCloning(true);
      const { data, error } = await supabase.rpc("clone_campaign_for_renegotiation", { 
        _source_campaign_id: campaign.id 
      });

      if (error) {
        toast.error("Erro ao criar renegociação: " + error.message);
        return;
      }

      toast.success("Renegociação criada!");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setIsRenegotiationAlertOpen(false);
      
      if (data) {
        navigate(`/agency/${agency?.id}/clients/${client?.id}/campaigns/${data}`);
      }
    } catch (err: any) {
      toast.error("Erro ao processar solicitação: " + err.message);
    } finally {
      setIsCloning(false);
    }
  };

  const handleToggleActive = async () => {
    const newValue = !campaign.is_active;
    
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: newValue })
      .eq('id', campaign.id);
    
    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(newValue 
        ? t("campaign.activated_success", "Campanha reativada com sucesso") 
        : t("campaign.inactivated_success", "Campanha inativada com sucesso")
      );
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsAlertOpen(false);
    }
  };

  const isInactive = campaign.is_active === false;

  return (
    <div className="space-y-4 mb-6">
      {isRenegotiation && (
        <div className="bg-stone-50 border-b border-stone-200 px-6 py-1.5 text-stone-600 text-[11px] flex items-center justify-between gap-2 rounded-t-lg -mx-4 sm:-mx-6 -mt-6 mb-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <Info size={12} className="text-stone-400" />
            <span>Você está visualizando uma <strong>{campaign.origin_label}</strong>.</span>
          </div>
          {campaign.root_campaign_id && (
            <Link 
              to={`/agency/${agency?.id}/clients/${client?.id}/campaigns/${campaign.root_campaign_id}`}
              className="flex items-center gap-1 hover:underline text-stone-500 font-medium"
            >
              Ver campanha original
              <ExternalLink size={10} />
            </Link>
          )}
        </div>
      )}

      {latestRenegotiation && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5 text-amber-800 text-[11px] flex items-center justify-between gap-2 rounded-t-lg -mx-4 sm:-mx-6 -mt-6 mb-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-500" />
            <span>Esta campanha possui uma renegociação mais recente em andamento.</span>
          </div>
          <Link 
            to={`/agency/${agency?.id}/clients/${client?.id}/campaigns/${latestRenegotiation.id}`}
            className="flex items-center gap-1 hover:underline text-amber-700 font-bold"
          >
            Ir para versão mais recente ({latestRenegotiation.origin_label || "Renegociação"})
            <ExternalLink size={10} />
          </Link>
        </div>
      )}

      {isInactive && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-red-700 text-sm flex items-center gap-2 rounded-t-lg -mx-4 sm:-mx-6 -mt-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle size={16} className="text-red-500" />
          {t("common.campaign_inactiveBanner")}
        </div>
      )}


      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={cn(
              "text-2xl font-bold flex items-center gap-2",
              isInactive ? "text-stone-400" : "text-foreground"
            )}>
              {campaign?.name}
              {isAdminOrMaster && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={onRename}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              )}
              {isRenegotiation && (
                <Badge variant="outline" className="h-6 border-stone-300 text-stone-600 bg-stone-50 font-medium">
                  {campaign.origin_label}
                </Badge>
              )}
            </h1>

            {isInactive && (
              <Badge variant="destructive" className="bg-red-100 text-red-600 border-red-200 hover:bg-red-100 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                {t("common.campaign_inactive")}
              </Badge>
            )}
            
            {isAdminOrMaster && (activeSection === "summary" || !activeSection) && (
              <>
                <Button
                  variant={isInactive ? "outline" : "destructive"}
                  size="sm"
                  onClick={() => isInactive ? handleToggleActive() : setIsAlertOpen(true)}
                  className={cn(
                    "h-8 transition-colors",
                    isInactive && "border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-emerald-50"
                  )}
                >
                  {isInactive ? (
                    <>
                      <PlayCircle size={14} className="mr-1.5" />
                      {t("campaign.reactivate", "Reativar Campanha")}
                    </>
                  ) : (
                    <>
                      <PowerOff size={14} className="mr-1.5" />
                      {t("campaign.inactivate", "Inativar Campanha")}
                    </>
                  )}
                </Button>

                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("campaign.inactivate_title", "Inativar campanha?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("campaign.inactivate_description", "Esta ação tornará a campanha invisível para todos os usuários, exceto admins e masters. Você poderá reativá-la depois.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleToggleActive}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("common.confirm", "Confirmar")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {client?.name} • {agency?.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeAdjustment && (
            <Badge 
              variant="outline" 
              className="border-amber-400 text-amber-700 gap-1 cursor-pointer"
              onClick={() => onOpenSection("adjustments")}
            >
              <Layers className="w-3 h-3" />
              {t("common.activeAdjustment")}: {activeAdjustment.name}
            </Badge>
          )}
          
          {isAdminOrMaster && (activeSection === "summary" || !activeSection) && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 h-8 bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-200"
                onClick={() => setIsRenegotiationAlertOpen(true)}
              >
                <GitBranch className="w-3.5 h-3.5" /> Solicitar renegociação
              </Button>

              <AlertDialog open={isRenegotiationAlertOpen} onOpenChange={setIsRenegotiationAlertOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Criar campanha de renegociação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isto cria uma NOVA campanha, cópia exata desta (peças, kits, rateio, Loja a Loja e cotação com todos os fornecedores). As duas ficam totalmente independentes — o que você fizer em uma não afeta a outra. A campanha atual continua existindo e ativa.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCloning}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.preventDefault();
                        handleCreateRenegotiation();
                      }}
                      disabled={isCloning}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isCloning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        "Criar renegociação"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {isAdminOrMaster && (activeSection === "summary" || !activeSection) && (
            <ExportAllPhotosDialog
              campaignId={campaign.id}
              campaignName={campaign.name}
            />
          )}
          
          {isAdminOrMaster && (activeSection === "summary" || !activeSection) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={onBackup}
            >
              <Database className="w-3.5 h-3.5" /> {t("common.backup")}
            </Button>
          )}

          {(isAdminOrMaster || canEditCampaign) && (activeSection === "summary" || !activeSection) && (
            <ExportReportDropdown
              campaignId={campaign.id}
              clientId={client?.id}
              campaignName={campaign.name}
              clientName={client?.name}
              pieces={pieces}
              kits={kits}
              kitPieces={kitPieces}
              agencyName={agency?.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}