import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Store, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OcorrenciasTab from "@/components/StorePortal/OcorrenciasTab";
import ManutencaoTab from "@/components/StorePortal/ManutencaoTab";
import ReposicoesTab from "@/components/StorePortal/ReposicoesTab";
import ConformidadeTab from "@/components/StorePortal/ConformidadeTab";

export interface PortalData {
  token_id: string;
  campaign: {
    id: string;
    name: string;
    client_id: string;
    clients: { name: string; agency_id: string; agencies: { name: string } };
  };
  store: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    store_code: string | null;
    nickname: string | null;
  };
  tipos: Array<{ id: string; nome: string; letra: string; tem_subdivisao: boolean | null; display_order: number | null }>;
  subdivisoes: Array<{ id: string; tipo_id: string; nome: string; display_order: number | null }>;
  pecas: Array<{ id: string; nome: string; image_url: string | null; tipo_id: string | null; subdivisao_id: string | null; display_order: number | null; campaign_id: string }>;
  lojas: Array<{ id: string; store_id: string; tipo_id: string | null; subdivisao_id: string | null; ativo: boolean | null; campaign_id: string }>;
}

export default function StorePortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    if (!token) { setError("Token não informado"); setLoading(false); return; }

    supabase.functions.invoke("validate-store-token", { body: { token } })
      .then(({ data: res, error: fnErr }) => {
        if (fnErr || !res?.success) {
          setError(res?.error || fnErr?.message || "Token inválido");
        } else {
          setData(res as PortalData);
        }
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground text-sm">{error || "Token inválido ou expirado."}</p>
        </div>
      </div>
    );
  }

  const agencyId = data.campaign.clients.agency_id;
  const agencyName = data.campaign.clients.agencies.name;
  const storeName = data.store.nickname || data.store.name;
  const storeLocation = [data.store.city, data.store.state].filter(Boolean).join("/");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#8C6F4E] text-white px-4 py-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Store className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs opacity-80 truncate">{agencyName}</p>
              <h1 className="text-lg font-bold truncate">{data.campaign.name}</h1>
            </div>
          </div>
          <p className="text-sm opacity-90 truncate">
            {storeName}{storeLocation ? ` — ${storeLocation}` : ""}
            {data.store.store_code ? ` (${data.store.store_code})` : ""}
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Tabs defaultValue="ocorrencias">
          <TabsList className="w-full grid grid-cols-4 h-auto">
            <TabsTrigger value="ocorrencias" className="text-xs sm:text-sm py-2">Ocorrências</TabsTrigger>
            <TabsTrigger value="manutencao" className="text-xs sm:text-sm py-2">Manutenção</TabsTrigger>
            <TabsTrigger value="reposicoes" className="text-xs sm:text-sm py-2">Reposições</TabsTrigger>
            <TabsTrigger value="conformidade" className="text-xs sm:text-sm py-2">Conformidade</TabsTrigger>
          </TabsList>

          <TabsContent value="ocorrencias">
            <OcorrenciasTab data={data} agencyId={agencyId} />
          </TabsContent>
          <TabsContent value="manutencao">
            <ManutencaoTab data={data} agencyId={agencyId} />
          </TabsContent>
          <TabsContent value="reposicoes">
            <ReposicoesTab data={data} agencyId={agencyId} />
          </TabsContent>
          <TabsContent value="conformidade">
            <ConformidadeTab data={data} agencyId={agencyId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
