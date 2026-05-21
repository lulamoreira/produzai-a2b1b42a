import React from "react";
import MockupTabComponent from "@/components/MockupTab";

interface MockupTabProps {
  campaignId: string;
}

export default function MockupTab({ campaignId }: MockupTabProps) {
  return <MockupTabComponent campaignId={campaignId} />;
}