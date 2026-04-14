import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiposManager from "@/components/LojaALoja/TiposManager";
import LojasManager from "@/components/LojaALoja/LojasManager";
import LojaALojaDashboard from "@/components/LojaALoja/LojaALojaDashboard";
import { LayoutGrid, Store, BarChart3 } from "lucide-react";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

export default function LojaALojaTab({ campaignId, clientId, isAdmin }: Props) {
  return (
    <Tabs defaultValue="lojas" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="tipos" className="gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" />
          Tipos de Lojas
        </TabsTrigger>
        <TabsTrigger value="lojas" className="gap-1.5">
          <Store className="h-3.5 w-3.5" />
          Lojas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tipos">
        <TiposManager campaignId={campaignId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="dashboard">
        <LojaALojaDashboard campaignId={campaignId} clientId={clientId} />
      </TabsContent>
      <TabsContent value="lojas">
        <LojasManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}
