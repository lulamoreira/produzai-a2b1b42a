import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Store, Search, Filter, X, LayoutList, Users, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StoreContactsCardView from "@/components/StoreContactsCardView";

interface StoresTabProps {
  campaignId: string;
  clientId: string;
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

  const filteredStores = useMemo(() => {
    return stores.filter((s) => (s.tipo_entrega ?? 'frete_instalacao') !== 'sem_logistica');
  }, [stores]);

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
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" /> Filtros
        </Button>
      </div>

      {storesViewMode === "table" ? (
        <Card className="overflow-hidden border-gray-200 dark:border-gray-700">
          <Table className="border-collapse">
            <TableHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Loja</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Cidade/UF</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Modelo</TableHead>
                <TableHead className="text-right text-gray-900 dark:text-gray-100 font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map(store => (
                <TableRow key={store.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700">
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    <div className="flex flex-col gap-1">
                      <span>{store.name}</span>
                      {store.tipo_entrega === "frete_apenas" ? (
                        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                          📦 Frete Apenas
                        </span>
                      ) : store.tipo_entrega === "sem_logistica" ? (
                        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300">
                          🏪 Sem Logística
                        </span>
                      ) : (
                        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          📦🔧 Frete + Instalação
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900 dark:text-gray-100">{store.city} / {store.state}</TableCell>
                  <TableCell className="text-gray-900 dark:text-gray-100">{store.store_model}</TableCell>
                  <TableCell className="text-right text-gray-900 dark:text-gray-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenEditStore(store)}>Editar loja</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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
    </div>
  );
}