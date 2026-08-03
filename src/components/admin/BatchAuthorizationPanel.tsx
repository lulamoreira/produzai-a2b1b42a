import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  Users, Building2, Briefcase, Megaphone, Shield, 
  Search, Check, CheckSquare, Square, AlertCircle, Loader2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAgencies } from "@/hooks/useAgencies";
import { useClients, useCampaigns } from "@/hooks/useMultiClientData";
import { usePermissionCategories } from "@/hooks/usePermissionCategories";
import { useBatchUserAccess } from "@/hooks/useBatchUserAccess";
import { capitalizeName, cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


export function BatchAuthorizationPanel() {
  const { t } = useTranslation();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const { data: agencies = [], isLoading: loadingAgencies } = useAgencies();
  const { data: categories = [] } = usePermissionCategories();
  
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<"agency" | "client" | "campaign">("client");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("keep_current");
  
  const [userSearch, setUserSearch] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [accessDetails, setAccessDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Secondary selections for dependent resources
  const [selectedAgencyIdForClients, setSelectedAgencyIdForClients] = useState<string>("all");
  const [selectedClientIdForCampaigns, setSelectedClientIdForCampaigns] = useState<string>("all");

  const { data: clients = [], isLoading: loadingClients } = useClients(
    selectedAgencyIdForClients !== "all" ? selectedAgencyIdForClients : undefined
  );
  
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns(
    selectedClientIdForCampaigns !== "all" ? selectedClientIdForCampaigns : undefined
  );

  const batchAccess = useBatchUserAccess();

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      (u.display_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.company || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      u.user_id.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [users, userSearch]);

  const filteredResources = useMemo(() => {
    if (resourceType === "agency") {
      return agencies.filter(a => a.name.toLowerCase().includes(resourceSearch.toLowerCase()));
    }
    if (resourceType === "client") {
      return clients.filter(c => c.name.toLowerCase().includes(resourceSearch.toLowerCase()));
    }
    if (resourceType === "campaign") {
      return campaigns.filter(c => c.name.toLowerCase().includes(resourceSearch.toLowerCase()));
    }
    return [];
  }, [resourceType, agencies, clients, campaigns, resourceSearch]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResourceIds(prev => 
      prev.includes(resourceId) ? prev.filter(id => id !== resourceId) : [...prev, resourceId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.user_id));
    }
  };

  const selectAllResources = () => {
    if (selectedResourceIds.length === filteredResources.length) {
      setSelectedResourceIds([]);
    } else {
      setSelectedResourceIds(filteredResources.map(r => r.id));
    }
  };

  const fetchAccessDetails = async () => {
    if (selectedUserIds.length === 0 || selectedResourceIds.length === 0) {
      toast.error("Selecione usuários e recursos primeiro.");
      return;
    }
    
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase.rpc("get_batch_user_access_details", {
        p_user_ids: selectedUserIds,
        p_resource_ids: selectedResourceIds,
        p_resource_type: resourceType
      });
      
      if (error) throw error;
      setAccessDetails(data || []);
      setShowPreview(true);
    } catch (e: any) {
      toast.error("Erro ao carregar prévia: " + e.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirm = () => {
    if (selectedUserIds.length === 0) {
      toast.error("Selecione pelo menos um usuário.");
      return;
    }
    if (selectedResourceIds.length === 0) {
      toast.error("Selecione pelo menos um recurso.");
      return;
    }
    if (!selectedCategoryId) {
      toast.error("Selecione uma categoria de acesso ou mantenha a atual.");
      return;
    }

    batchAccess.mutate({
      userIds: selectedUserIds,
      resourceIds: selectedResourceIds,
      resourceType,
      categoryId: selectedCategoryId === "keep_current" ? null : selectedCategoryId
    }, {
      onSuccess: () => {
        setSelectedUserIds([]);
        setSelectedResourceIds([]);
        setShowPreview(false);
        setAccessDetails([]);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* User Selection */}
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  1. Selecionar Usuários
                </CardTitle>
                <CardDescription>
                  {selectedUserIds.length} selecionados
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8"
                onClick={selectAllUsers}
              >
                {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome ou empresa..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <div 
                      key={u.user_id}
                      onClick={() => toggleUser(u.user_id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer text-sm",
                        selectedUserIds.includes(u.user_id) 
                          ? "bg-primary/5 border-primary" 
                          : "hover:bg-muted border-transparent"
                      )}
                    >
                      <Checkbox 
                        checked={selectedUserIds.includes(u.user_id)}
                        onCheckedChange={() => toggleUser(u.user_id)}
                        className="pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{capitalizeName(u.display_name) || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.company || "Empresa não informada"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 uppercase">
                        {u.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Resource Selection */}
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  2. Selecionar Recursos
                </CardTitle>
                <CardDescription>
                  {selectedResourceIds.length} selecionados
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8"
                onClick={selectAllResources}
              >
                {selectedResourceIds.length === filteredResources.length && filteredResources.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => { setResourceType("agency"); setSelectedResourceIds([]); }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    resourceType === "agency" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="w-3 h-3" />
                  Agências
                </button>
                <button
                  onClick={() => { setResourceType("client"); setSelectedResourceIds([]); }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    resourceType === "client" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Briefcase className="w-3 h-3" />
                  Clientes
                </button>
                <button
                  onClick={() => { setResourceType("campaign"); setSelectedResourceIds([]); }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    resourceType === "campaign" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Megaphone className="w-3 h-3" />
                  Campanhas
                </button>
              </div>

              {resourceType === "client" && (
                <Select value={selectedAgencyIdForClients} onValueChange={setSelectedAgencyIdForClients}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filtrar por Agência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Agências</SelectItem>
                    {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {resourceType === "campaign" && (
                <Select value={selectedClientIdForCampaigns} onValueChange={setSelectedClientIdForCampaigns}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filtrar por Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Clientes</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder={`Buscar ${resourceType === 'agency' ? 'agência' : resourceType === 'client' ? 'cliente' : 'campanha'}...`}
                  value={resourceSearch}
                  onChange={e => setResourceSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {(loadingAgencies || loadingClients || loadingCampaigns) ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredResources.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum recurso encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {filteredResources.map(r => (
                    <div 
                      key={r.id}
                      onClick={() => toggleResource(r.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer text-sm",
                        selectedResourceIds.includes(r.id) 
                          ? "bg-primary/5 border-primary" 
                          : "hover:bg-muted border-transparent"
                      )}
                    >
                      <Checkbox 
                        checked={selectedResourceIds.includes(r.id)}
                        onCheckedChange={() => toggleResource(r.id)}
                        className="pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{r.name}</p>
                        {resourceType === "client" && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {agencies.find(a => a.id === r.agency_id)?.name || "Agência desconhecida"}
                          </p>
                        )}
                        {resourceType === "campaign" && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {clients.find(c => c.id === r.client_id)?.name || "Cliente desconhecido"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Area */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            3. Definir Acesso e Confirmar
          </CardTitle>
          <CardDescription>
            Defina o papel de acesso para as associações selecionadas acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Categoria de Acesso</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep_current">Manter Categoria Atual</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                A categoria define quais módulos o usuário poderá acessar dentro do recurso.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1 h-10 font-bold bg-white"
                onClick={() => {
                  if (selectedUserIds.length === 0 || selectedResourceIds.length === 0) {
                    toast.error("Selecione usuários e recursos primeiro.");
                    return;
                  }
                  setShowPreview(true);
                }}
              >
                Visualizar Prévia
              </Button>
              <Button 
                className="flex-[2] h-10 font-bold" 
                onClick={handleConfirm}
                disabled={batchAccess.isPending}
              >
                {batchAccess.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Confirmar {selectedUserIds.length * selectedResourceIds.length} Associações
                  </>
                )}
              </Button>
            </div>
          </div>

          {showPreview && (
            <div className="mt-6 p-4 bg-white border rounded-xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  Resumo da Operação
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="h-7 text-xs">
                  Fechar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuários Afetados ({selectedUserIds.length})</p>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 bg-stone-50 space-y-1">
                    {users.filter(u => selectedUserIds.includes(u.user_id)).map(u => (
                      <div key={u.user_id} className="text-[11px] flex justify-between">
                        <span className="font-medium">{capitalizeName(u.display_name)}</span>
                        <span className="text-muted-foreground">{u.company}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recursos ({selectedResourceIds.length})</p>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 bg-stone-50 space-y-1">
                    {filteredResources.filter(r => selectedResourceIds.includes(r.id)).map(r => (
                      <div key={r.id} className="text-[11px] font-medium">
                        {r.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-stone-600 space-y-1">
                  <p><strong>Impacto:</strong> Serão criados até {selectedUserIds.length * selectedResourceIds.length} registros de acesso.</p>
                  <p>A categoria será <strong>{selectedCategoryId === "keep_current" ? "MANTIDA" : categories.find(c => c.id === selectedCategoryId)?.name}</strong>.</p>
                  <p>Acessos existentes não serão removidos, apenas atualizados ou adicionados.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
