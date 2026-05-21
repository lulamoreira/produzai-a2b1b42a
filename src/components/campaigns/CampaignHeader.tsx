import React from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Database, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ExportReportDropdown from "@/components/ExportReportDropdown";
import ExportAllPhotosDialog from "@/components/ExportAllPhotosDialog";

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

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
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
              Ajuste ativo: {activeAdjustment.name}
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
              <Database className="w-3.5 h-3.5" /> Backup
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