import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Table2, BarChart3 as BarChart3Icon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";

interface MatrixTabProps {
  campaignId: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  stores: any[];
  qtyMap: Record<string, number>;
}

export default function MatrixTab({
  campaignId,
  pieces,
  kits,
  kitPieces,
  stores,
  qtyMap
}: MatrixTabProps) {
  const { t } = useTranslation();
  const [rateioView, setRateioView] = useState("planilha");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={rateioView} onValueChange={setRateioView} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border bg-muted/20 px-2 sm:px-3 pt-2">
            <TabsList className="h-8 bg-muted/60">
              <TabsTrigger value="planilha" className="text-xs gap-1.5 h-6 px-2.5">
                <Table2 className="w-3.5 h-3.5" />
                Planilha
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="text-xs gap-1.5 h-6 px-2.5">
                <BarChart3Icon className="w-3.5 h-3.5" />
                Dashboard
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="planilha" className="flex-1 flex flex-col overflow-hidden mt-0">
             <div className="p-4 text-muted-foreground text-sm italic">
               A matriz de rateio está sendo carregada...
             </div>
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 overflow-hidden mt-0">
            <MatrixDistributionDashboard 
              stores={stores}
              pieces={pieces}
              kits={kits}
              kitPieces={kitPieces}
              qtyMap={qtyMap}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}