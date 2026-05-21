import React from "react";
import BudgetTabComponent from "@/components/Budget/BudgetTab";

interface BudgetTabProps {
  campaignId: string;
  isAdmin: boolean;
}

export default function BudgetTab({ campaignId, isAdmin }: BudgetTabProps) {
  return (
    <BudgetTabComponent
      campaignId={campaignId}
      isAdmin={isAdmin}
    />
  );
}