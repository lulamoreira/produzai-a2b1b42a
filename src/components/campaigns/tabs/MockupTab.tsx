import React from "react";
import MockupTabComponent from "@/components/MockupTab";

interface MockupTabProps {
  campaignId: string;
  campaignName: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
}

export default function MockupTab({ 
  campaignId, 
  campaignName,
  pieces,
  kits,
  kitPieces
}: MockupTabProps) {
  return (
    <MockupTabComponent 
      campaignId={campaignId} 
      campaignName={campaignName}
      pieces={pieces}
      kits={kits}
      kitPieces={kitPieces}
    />
  );
}