import React from "react";
import CampaignActivityHistory from "@/components/CampaignActivityHistory";

interface HistoryTabProps {
  campaignId: string;
}

export default function HistoryTab({ campaignId }: HistoryTabProps) {
  return <CampaignActivityHistory campaignId={campaignId} />;
}