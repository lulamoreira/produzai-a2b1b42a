import React from "react";
import LojaALojaTab from "@/components/LojaALoja/LojaALojaTab";

interface OccurrencesTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function OccurrencesTab({ campaignId, clientId, lalPerms }: OccurrencesTabProps) {
  return (
    <LojaALojaTab 
      campaignId={campaignId} 
      clientId={clientId} 
      permissions={lalPerms} 
      initialTab="portal-dashboard" 
    />
  );
}