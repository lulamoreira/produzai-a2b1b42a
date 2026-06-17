import React from "react";
import { useSearchParams } from "react-router-dom";
import LojaALojaTabComponent from "@/components/LojaALoja/LojaALojaTab";

interface LojaALojaTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function LojaALojaTab({ campaignId, clientId, lalPerms }: LojaALojaTabProps) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || undefined;
  return (
    <LojaALojaTabComponent
      campaignId={campaignId}
      clientId={clientId}
      permissions={lalPerms}
      initialTab={initialTab}
    />
  );
}