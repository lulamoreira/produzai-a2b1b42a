import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiposManager from "@/components/LojaALoja/TiposManager";
import LojasManager from "@/components/LojaALoja/LojasManager";
import { LayoutGrid, Store } from "lucide-react";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

export default function LojaALojaTab({ campaignId, clientId, isAdmin }: Props) {
  return (
    <Tabs defaultValue="tipos" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="tipos" className="gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" />
          Cadastro de Tipos
        </TabsTrigger>
        <TabsTrigger value="lojas" className="gap-1.5">
          <Store className="h-3.5 w-3.5" />
          Lojas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tipos">
        <TiposManager campaignId={campaignId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="lojas">
        <LojasManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}
