import { useNavigate } from "react-router-dom";
import type { Campaign } from "@/hooks/useMultiClientData";
import { ArrowRight } from "lucide-react";

interface CampaignCardV2Props {
  campaign: Campaign;
  storeCount: number;
  pieceCount: number;
  agencyId: string;
  clientId: string;
  clientName: string;
}

export default function CampaignCardV2({ campaign, storeCount, pieceCount, agencyId, clientId, clientName }: CampaignCardV2Props) {
  const navigate = useNavigate();
  const color = campaign.color || "#6366f1";

  return (
    <div
      className="card-v2 cursor-pointer group"
      data-status="neutral"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}/campaigns/${campaign.id}`)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: color }}
        >
          {campaign.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
            <span className="badge-v2 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
              ● Ativa
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {clientName} · Criada em {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeCount} lojas · {pieceCount} peças
          </p>
        </div>

        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
    </div>
  );
}
