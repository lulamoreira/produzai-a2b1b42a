import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Database, Layers, PauseCircle, PlayCircle, AlertTriangle, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const [isAlertOpen, setIsAlertOpen] = useState(false);

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
      {isInactive && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-amber-700 text-sm flex items-center gap-2 rounded-t-lg -mx-4 sm:-mx-6 -mt-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle size={16} className="text-amber-500" />
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