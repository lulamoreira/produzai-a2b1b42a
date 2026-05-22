import React from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Database, Layers, PauseCircle, PlayCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExportReportDropdown from "@/components/ExportReportDropdown";
import ExportAllPhotosDialog from "@/components/ExportAllPhotosDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
  pieces,
  kits,
  kitPieces
}: CampaignHeaderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleToggleActive = async () => {
    const newValue = !campaign.is_active;
    const confirmMsg = newValue
      ? t("common.campaign_confirmActivate")
      : t("common.campaign_confirmDeactivate");
    
    if (!window.confirm(confirmMsg)) return;
    
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: newValue })
      .eq('id', campaign.id);
    
    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(newValue ? t("common.campaign_activated") : t("common.campaign_deactivated"));
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
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
            
            {isAdminOrMaster && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                className={cn(
                  "h-8 transition-colors",
                  !isInactive
                    ? "border-stone-200 text-stone-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-emerald-50"
                )}
              >
                {!isInactive
                  ? <><PauseCircle size={14} className="mr-1.5" />{t("common.campaign_deactivate")}</>
                  : <><PlayCircle size={14} className="mr-1.5" />{t("common.campaign_activate")}</>
                }
              </Button>
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
          
          {isAdminOrMaster && (
            <ExportAllPhotosDialog
              campaignId={campaign.id}
              campaignName={campaign.name}
            />
          )}
          
          {isAdminOrMaster && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={onBackup}
            >
              <Database className="w-3.5 h-3.5" /> {t("common.backup")}
            </Button>
          )}

          {(isAdminOrMaster || canEditCampaign) && (
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