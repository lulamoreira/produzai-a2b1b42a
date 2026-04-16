import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiposManager from "@/components/LojaALoja/TiposManager";
import LojasManager from "@/components/LojaALoja/LojasManager";
import LojaALojaDashboard from "@/components/LojaALoja/LojaALojaDashboard";
import PortaisManager from "@/components/LojaALoja/PortaisManager";
import PortalDashboard from "@/components/LojaALoja/PortalDashboard";
import { LayoutGrid, Store, BarChart3, Settings2, LayoutDashboard } from "lucide-react";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

export default function LojaALojaTab({ campaignId, clientId, isAdmin }: Props) {
  return (
    <Tabs defaultValue="lojas" className="w-full">
      <TabsList className="mb-4 flex-wrap h-auto gap-1">
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="portal-dashboard" className="gap-1.5">
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard Portal
        </TabsTrigger>
        <TabsTrigger value="tipos" className="gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" />
          Tipos de Lojas
        </TabsTrigger>
        <TabsTrigger value="lojas" className="gap-1.5">
          <Store className="h-3.5 w-3.5" />
          Lojas
        </TabsTrigger>
        <TabsTrigger value="portais" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Portais
        </TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        <LojaALojaDashboard campaignId={campaignId} clientId={clientId} />
      </TabsContent>
      <TabsContent value="portal-dashboard">
        <PortalDashboard campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="tipos">
        <TiposManager campaignId={campaignId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="lojas">
        <LojasManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="portais">
        <PortaisManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}
