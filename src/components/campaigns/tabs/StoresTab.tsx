import React, { useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Store, Search, Filter, X, LayoutList, Users, MapPin, Phone, User, Hash, Info, Truck, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StoreContactsCardView from "@/components/StoreContactsCardView";
import LojaPdfTemplate from "@/components/LojaPdfTemplate";
import { useCampaignStoreStatus, useUpsertCampaignStoreStatus } from "@/hooks/useMultiClientData";
import { toast } from "sonner";
import { getStateColor } from "@/lib/stateColors";

interface StoresTabProps {
  campaignId: string;
  clientId: string;
  allStores: any[];
  stores: any[];
  canEditStores: boolean;
  canEditCampaignStores: boolean;
  isLimitedMode: boolean;
  onOpenEditStore: (store: any) => void;
  agencyName: string;
  clientName: string;
}

export default function StoresTab({
  campaignId,
  clientId,
  allStores,
  stores,
  canEditStores,
  canEditCampaignStores,
  isLimitedMode,
  onOpenEditStore,
  agencyName,
  clientName
}: StoresTabProps) {
  const { t } = useTranslation();
  const [storeSearch, setStoreSearch] = useState("");
  const [storesViewMode, setStoresViewMode] = useState<"table" | "contacts">("table");
  const [selectedStore, setSelectedStore] = useState<any | null>(null);

  const { data: campaignStoreStatus = [] } = useCampaignStoreStatus(campaignId);
  const upsertStatus = useUpsertCampaignStoreStatus();

  const filteredStores = useMemo(() => {
    let result = allStores;
    if (storeSearch) {
      const q = storeSearch.toLowerCase().trim();
      result = result.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.nickname && s.nickname.toLowerCase().includes(q)) ||
        (s.store_code && s.store_code.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.state && s.state.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allStores, storeSearch]);

  const handleToggleStore = async (storeId: string, currentEnabled: boolean) => {
    try {
      await upsertStatus.mutateAsync({
        campaignId,
        store_id: storeId,
        enabled: !currentEnabled
      } as any);
    } catch (error: any) {
      toast.error("Erro ao atualizar status da loja: " + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("modules.stores")}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredStores.length} registradas
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md border border-input bg-background p-1">
            <Button
              variant={storesViewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setStoresViewMode("table")}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tabela
            </Button>
            <Button
              variant={storesViewMode === "contacts" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setStoresViewMode("contacts")}
            >
              <Users className="w-3.5 h-3.5" />
              Contatos
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("stores.searchAll")}
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {storeSearch && (
            <button onClick={() => setStoreSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {storesViewMode === "table" ? (
        <Card className="overflow-hidden border-gray-200 dark:border-gray-700">
          <Table className="border-collapse">
            <TableHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Loja</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Cidade/UF</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Modelo</TableHead>
                <TableHead className="text-right text-gray-900 dark:text-gray-100 font-semibold w-[100px]">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.map(store => {
                const status = campaignStoreStatus.find(s => s.store_id === store.id);
                const isEnabled = status ? status.enabled : true;

                return (
                  <TableRow key={store.id} className={cn(
                    "odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700",
                    !isEnabled && "opacity-60 grayscale-[0.5]"
                  )}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex flex-col gap-1">
                        <span 
                          translate="no"
                          className="cursor-pointer hover:underline text-primary"
                          onClick={() => setSelectedStore(store)}
                        >
                          {store.name}
                        </span>
                        {store.nickname && <span translate="no" className="text-[11px] text-muted-foreground">{store.nickname}</span>}
                        <div className="flex gap-1 mt-1">
                          {store.tipo_entrega === "frete_apenas" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                              📦 Frete Apenas
                            </span>
                          ) : store.tipo_entrega === "sem_logistica" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300">
                              🏪 Sem Logística
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                              📦🔧 Frete + Instalação
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell translate="no" className="text-gray-900 dark:text-gray-100">{store.city} / {store.state}</TableCell>
                    <TableCell translate="no" className="text-gray-900 dark:text-gray-100">{store.store_model}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end pr-4">
                        <Switch 
                          checked={isEnabled}
                          onCheckedChange={() => handleToggleStore(store.id, isEnabled)}
                          disabled={upsertStatus.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <StoreContactsCardView 
          stores={stores} 
          clientId={clientId} 
          canEdit={canEditStores}
          agencyName={agencyName}
          clientName={clientName}
        />
      )}

      <Dialog open={!!selectedStore} onOpenChange={(open) => !open && setSelectedStore(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Detalhes da Loja
            </DialogTitle>
          </DialogHeader>
          
          {selectedStore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" /> Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Nome</span>
                    <span translate="no" className="text-sm font-medium">{selectedStore.name}</span>
                  </div>
                  {selectedStore.nickname && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Apelido</span>
                      <span translate="no" className="text-sm font-medium">{selectedStore.nickname}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Código</span>
                    <span translate="no" className="text-sm font-medium font-mono">{selectedStore.store_code || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Modelo</span>
                    <span translate="no" className="text-sm font-medium">{selectedStore.store_model || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Localização
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Endereço</span>
                    <span className="text-sm font-medium">
                      {selectedStore.street || ""}, {selectedStore.number || ""} {selectedStore.complement || ""}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Bairro</span>
                    <span className="text-sm font-medium">{selectedStore.neighborhood || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Cidade/UF</span>
                    <span translate="no" className="text-sm font-medium">
                      {selectedStore.city || "—"} / {selectedStore.state || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">CEP</span>
                    <span className="text-sm font-medium">{selectedStore.zip_code || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Contato Direto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Responsável</span>
                    <span className="text-sm font-medium">{selectedStore.manager_name || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Telefone</span>
                    <span className="text-sm font-medium">{selectedStore.phone || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">E-mail</span>
                    <span className="text-sm font-medium truncate" title={selectedStore.email}>{selectedStore.email || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" /> Logística
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Tipo de Entrega</span>
                    <div className="mt-1">
                      {selectedStore.tipo_entrega === "frete_apenas" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                          📦 Frete Apenas
                        </span>
                      ) : selectedStore.tipo_entrega === "sem_logistica" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300">
                          🏪 Sem Logística
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          📦🔧 Frete + Instalação
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedStore.cnpj && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">CNPJ</span>
                      <span className="text-sm font-medium font-mono">{selectedStore.cnpj}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {selectedStore.observations && (
                <Card className="bg-muted/30 md:col-span-2">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedStore.observations}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}