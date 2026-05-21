import React from "react";
import LojaALojaTabComponent from "@/components/LojaALoja/LojaALojaTab";

interface LojaALojaTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function LojaALojaTab({ campaignId, clientId, lalPerms }: LojaALojaTabProps) {
  return (
    <LojaALojaTabComponent 
      campaignId={campaignId} 
      clientId={clientId} 
      permissions={lalPerms} 
    />
  );
}