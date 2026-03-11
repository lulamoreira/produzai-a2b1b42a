import { useState } from "react";
import { capitalizeName } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import {
  useClients, useUserClientAccess, useAddUserClientAccess,
  useUpdateUserClientAccess, useDeleteUserClientAccess,
  useCampaigns,
  type UserClientAccess,
} from "@/hooks/useMultiClientData";
import {
  usePermissionCategories, type PermissionCategory,
} from "@/hooks/usePermissionCategories";
import { useAgencies } from "@/hooks/useAgencies";
import {
  useUserAgencyAccess, useAddUserAgencyAccess,
  useUpdateUserAgencyAccess, useDeleteUserAgencyAccess,
  type UserAgencyAccess,
} from "@/hooks/useUserAgencyAccess";
import {
  useUserCampaignAccess, useAddUserCampaignAccess,
  useUpdateUserCampaignAccess, useDeleteUserCampaignAccess,
  type UserCampaignAccess,
} from "@/hooks/useUserCampaignAccess";
import { useUpdateUserRole, type UserWithRole } from "@/hooks/useAdminUsers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronRight, Edit3, Plus, Trash2,
  PauseCircle, PlayCircle, Building2, KeyRound, Shield, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  userInfo: UserWithRole;
  allClientAccess: UserClientAccess[];
  allAgencyAccess: UserAgencyAccess[];
  allCampaignAccess: UserCampaignAccess[];
}

export default function UserPermissionCard({ userInfo, allClientAccess, allAgencyAccess, allCampaignAccess }: Props) {
  const { user } = useAuth();
  const { isAdmin, isAdminOrMaster } = useUserRole();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useClients();
  const { data: agencies = [] } = useAgencies();
  const { data: categories = [] } = usePermissionCategories();

  const addClientAccess = useAddUserClientAccess();
  const updateClientAccess = useUpdateUserClientAccess();
  const deleteClientAccess = useDeleteUserClientAccess();
  const addAgencyAccess = useAddUserAgencyAccess();
  const updateAgencyAccess = useUpdateUserAgencyAccess();
  const deleteAgencyAccess = useDeleteUserAgencyAccess();
  const addCampaignAccess = useAddUserCampaignAccess();
  const updateCampaignAccess = useUpdateUserCampaignAccess();
  const deleteCampaignAccess = useDeleteUserCampaignAccess();

  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const [addingClient, setAddingClient] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newClientCategoryId, setNewClientCategoryId] = useState("");
  const [addingAgency, setAddingAgency] = useState(false);
  const [newAgencyId, setNewAgencyId] = useState("");
  const [newAgencyCategoryId, setNewAgencyCategoryId] = useState("");
  const [addingCampaign, setAddingCampaign] = useState(false);
  const [newCampaignClientId, setNewCampaignClientId] = useState("");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [newCampaignCategoryId, setNewCampaignCategoryId] = useState("");

  const { data: campaignsForClient = [] } = useCampaigns(newCampaignClientId || undefined);

  const isCurrentUser = userInfo.user_id === user?.id;
  const userAccesses = allClientAccess.filter(a => a.user_id === userInfo.user_id);
  const userAgencyAccesses = allAgencyAccess.filter(a => a.user_id === userInfo.user_id);
  const userCampaignAccesses = allCampaignAccess.filter(a => a.user_id === userInfo.user_id);

  const canEditName = isAdminOrMaster && (userInfo.role !== "admin" || isAdmin);
  const canChangeRole = isAdminOrMaster && !isCurrentUser;
  const isAdminOrMasterUser = userInfo.role === "admin" || userInfo.role === "master";

  const getClientLabel = (clientId: string) => {
    const c = clients.find(c => c.id === clientId);
    if (!c) return clientId.slice(0, 8);
    const ag = agencies.find(a => a.id === c.agency_id);
    return ag ? `${ag.name} / ${c.name}` : c.name;
  };

  const getCampaignLabel = (campaignId: string) => {
    // We need to find the campaign across all clients
    for (const client of clients) {
      // We'll just show campaign ID for now, will be enriched
    }
    return campaignId.slice(0, 8);
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nameValue.trim() })
      .eq("user_id", userInfo.user_id);
    if (error) toast.error("Erro ao atualizar nome.");
    else {
      toast.success("Nome atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
    }
    setEditingName(false);
  };

  const handleRoleChange = (newRole: AppRole) => {
    if (!isAdmin && newRole === "admin") return;
    updateRole.mutate({ userId: userInfo.user_id, newRole });
  };

  const handleAddClientAccess = () => {
    if (!newClientId || !newClientCategoryId) return;
    const existing = userAccesses.find(a => a.client_id === newClientId);
    if (existing) { toast.error("Já possui acesso a este cliente."); return; }
    addClientAccess.mutate({ user_id: userInfo.user_id, client_id: newClientId, can_edit: false, category_id: newClientCategoryId });
    setAddingClient(false); setNewClientId(""); setNewClientCategoryId("");
  };

  const handleAddAgencyAccess = () => {
    if (!newAgencyId || !newAgencyCategoryId) return;
    const existing = userAgencyAccesses.find(a => a.agency_id === newAgencyId);
    if (existing) { toast.error("Já possui acesso a esta agência."); return; }
    addAgencyAccess.mutate({ user_id: userInfo.user_id, agency_id: newAgencyId, category_id: newAgencyCategoryId });
    setAddingAgency(false); setNewAgencyId(""); setNewAgencyCategoryId("");
  };

  const handleAddCampaignAccess = () => {
    if (!newCampaignId || !newCampaignCategoryId) return;
    const existing = userCampaignAccesses.find(a => a.campaign_id === newCampaignId);
    if (existing) { toast.error("Já possui acesso a esta campanha."); return; }
    addCampaignAccess.mutate({ user_id: userInfo.user_id, campaign_id: newCampaignId, category_id: newCampaignCategoryId });
    setAddingCampaign(false); setNewCampaignClientId(""); setNewCampaignId(""); setNewCampaignCategoryId("");
  };

  const roleBadge = () => {
    if (userInfo.role === "admin") return <Badge variant="default" className="text-[10px] uppercase tracking-wider">Admin</Badge>;
    if (userInfo.role === "master") return <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-orange-500/15 text-orange-700 border-orange-500/30">Master</Badge>;
    return <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Usuário</Badge>;
  };

  const totalAccesses = userAccesses.length + userAgencyAccesses.length + userCampaignAccesses.length;

  const AccessRow = ({ label, icon, suspended, categoryId, onChangeCategory, onToggleSuspend, onDelete, deleteTitle, deleteDesc }: {
    label: string; icon: React.ReactNode; suspended: boolean; categoryId: string | null;
    onChangeCategory: (val: string) => void; onToggleSuspend: () => void; onDelete: () => void;
    deleteTitle: string; deleteDesc: string;
  }) => (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${suspended ? "opacity-50 bg-muted/30 border-border" : "bg-muted/10 border-border"}`}>
      {icon}
      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{label}</span>
      <Select value={categoryId || ""} onValueChange={onChangeCategory}>
        <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Badge variant="outline" className={`text-[10px] shrink-0 ${suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
        {suspended ? "Suspenso" : "Ativo"}
      </Badge>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={suspended ? "Reativar" : "Suspender"} onClick={onToggleSuspend}>
        {suspended ? <PlayCircle className="w-3.5 h-3.5 text-green-600" /> : <PauseCircle className="w-3.5 h-3.5 text-yellow-600" />}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <Input className="h-7 text-sm w-44" value={nameValue} onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }} autoFocus />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSaveName}>OK</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="font-semibold text-foreground text-sm truncate">{capitalizeName(userInfo.display_name) || "Sem nome"}</p>
              {canEditName && (
                <button className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); setEditingName(true); setNameValue(userInfo.display_name || ""); }}>
                  <Edit3 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-0.5">{userInfo.user_id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {roleBadge()}
          {isCurrentUser && <span className="text-xs text-muted-foreground italic">(Você)</span>}
          {!isAdminOrMasterUser && totalAccesses > 0 && (
            <Badge variant="outline" className="text-[10px]">{totalAccesses} acesso{totalAccesses !== 1 ? "s" : ""}</Badge>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Role Selector */}
          {canChangeRole && (
            <div className="px-5 py-3 bg-muted/20 border-b border-border flex items-center gap-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">Tipo de Acesso</label>
              <Select value={userInfo.role} onValueChange={val => handleRoleChange(val as AppRole)}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="admin">👑 Admin</SelectItem>}
                  <SelectItem value="master">⚡ Master</SelectItem>
                  <SelectItem value="viewer">👤 Usuário</SelectItem>
                </SelectContent>
              </Select>
              {isAdminOrMasterUser && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {userInfo.role === "admin" ? "Acesso total e irrestrito" : "Acesso total (exceto gestão de usuários)"}
                </span>
              )}
            </div>
          )}

          {!isAdminOrMasterUser && (
            <>
              {/* Agency Accesses */}
              <div className="px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Acessos por Agência</h4>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Todos os clientes da agência</span>
                </div>
                {userAgencyAccesses.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {userAgencyAccesses.map(a => {
                      const ag = agencies.find(ag => ag.id === a.agency_id);
                      return <AccessRow key={a.id} label={ag?.name || "—"}
                        icon={<Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        suspended={a.suspended} categoryId={a.category_id}
                        onChangeCategory={val => updateAgencyAccess.mutate({ id: a.id, category_id: val })}
                        onToggleSuspend={() => updateAgencyAccess.mutate({ id: a.id, suspended: !a.suspended })}
                        onDelete={() => deleteAgencyAccess.mutate(a.id)}
                        deleteTitle={`Remover acesso à agência "${ag?.name}"?`}
                        deleteDesc="O usuário perderá acesso a todos os clientes desta agência."
                      />;
                    })}
                  </div>
                )}
                {addingAgency ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newAgencyId} onValueChange={setNewAgencyId}>
                      <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Agência" /></SelectTrigger>
                      <SelectContent>
                        {agencies.filter(a => !userAgencyAccesses.some(ua => ua.agency_id === a.id)).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newAgencyCategoryId} onValueChange={setNewAgencyCategoryId}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddAgencyAccess} disabled={!newAgencyId || !newAgencyCategoryId}>Adicionar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingAgency(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setAddingAgency(true)}>
                    <Plus className="w-3 h-3" /> Adicionar agência
                  </Button>
                )}
              </div>

              {/* Client Accesses */}
              <div className="px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Acessos por Cliente</h4>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Todas as campanhas do cliente</span>
                </div>
                {userAccesses.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {userAccesses.map(a => (
                      <AccessRow key={a.id} label={getClientLabel(a.client_id)}
                        icon={<KeyRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        suspended={a.suspended} categoryId={a.category_id}
                        onChangeCategory={val => updateClientAccess.mutate({ id: a.id, can_edit: false, category_id: val })}
                        onToggleSuspend={() => updateClientAccess.mutate({ id: a.id, can_edit: a.can_edit, suspended: !a.suspended })}
                        onDelete={() => deleteClientAccess.mutate(a.id)}
                        deleteTitle={`Remover acesso ao cliente "${getClientLabel(a.client_id)}"?`}
                        deleteDesc="O usuário perderá todas as permissões neste cliente."
                      />
                    ))}
                  </div>
                )}
                {addingClient ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newClientId} onValueChange={setNewClientId}>
                      <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.filter(c => !userAccesses.some(a => a.client_id === c.id)).map(c => (
                          <SelectItem key={c.id} value={c.id}>{getClientLabel(c.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newClientCategoryId} onValueChange={setNewClientCategoryId}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddClientAccess} disabled={!newClientId || !newClientCategoryId}>Adicionar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingClient(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setAddingClient(true)}>
                    <Plus className="w-3 h-3" /> Adicionar cliente
                  </Button>
                )}
              </div>

              {/* Campaign Accesses */}
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Acessos por Campanha</h4>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Acesso a uma campanha específica</span>
                </div>
                {userCampaignAccesses.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {userCampaignAccesses.map(a => (
                      <CampaignAccessRow key={a.id} access={a} clients={clients} agencies={agencies} categories={categories}
                        onChangeCategory={val => updateCampaignAccess.mutate({ id: a.id, category_id: val })}
                        onToggleSuspend={() => updateCampaignAccess.mutate({ id: a.id, suspended: !a.suspended })}
                        onDelete={() => deleteCampaignAccess.mutate(a.id)}
                      />
                    ))}
                  </div>
                )}
                {addingCampaign ? (
                  <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newCampaignClientId} onValueChange={val => { setNewCampaignClientId(val); setNewCampaignId(""); }}>
                      <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{getClientLabel(c.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={newCampaignId} onValueChange={setNewCampaignId} disabled={!newCampaignClientId}>
                      <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Campanha" /></SelectTrigger>
                      <SelectContent>
                        {campaignsForClient.filter(c => !userCampaignAccesses.some(a => a.campaign_id === c.id)).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newCampaignCategoryId} onValueChange={setNewCampaignCategoryId}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddCampaignAccess} disabled={!newCampaignId || !newCampaignCategoryId}>Adicionar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCampaign(false); setNewCampaignClientId(""); }}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setAddingCampaign(true)}>
                    <Plus className="w-3 h-3" /> Adicionar campanha
                  </Button>
                )}

                {userAccesses.length === 0 && userAgencyAccesses.length === 0 && userCampaignAccesses.length === 0 && !addingClient && !addingAgency && !addingCampaign && (
                  <p className="text-xs text-muted-foreground italic mt-2">Este usuário não possui nenhum acesso configurado.</p>
                )}
              </div>
            </>
          )}

          {isAdminOrMasterUser && (
            <div className="px-5 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                {userInfo.role === "admin"
                  ? "🔑 Acesso total e irrestrito a todo o sistema."
                  : "⚡ Acesso total a agências e clientes. Sem acesso à aba Backup e exclusão de usuários."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component to fetch campaign name
function CampaignAccessRow({ access, clients, agencies, categories, onChangeCategory, onToggleSuspend, onDelete }: {
  access: UserCampaignAccess;
  clients: Array<{ id: string; name: string; agency_id: string }>;
  agencies: Array<{ id: string; name: string }>;
  categories: Array<PermissionCategory>;
  onChangeCategory: (val: string) => void;
  onToggleSuspend: () => void;
  onDelete: () => void;
}) {
  const { data: campaign } = useQuery({
    queryKey: ["campaign", access.campaign_id],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("id, name, client_id").eq("id", access.campaign_id).single();
      return data;
    },
  });

  const client = campaign ? clients.find(c => c.id === campaign.client_id) : null;
  const agency = client ? agencies.find(a => a.id === client.agency_id) : null;
  const label = campaign ? `${agency?.name || ""} / ${client?.name || ""} / ${campaign.name}` : access.campaign_id.slice(0, 8);

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${access.suspended ? "opacity-50 bg-muted/30 border-border" : "bg-muted/10 border-border"}`}>
      <Megaphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{label}</span>
      <Select value={access.category_id || ""} onValueChange={onChangeCategory}>
        <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Badge variant="outline" className={`text-[10px] shrink-0 ${access.suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
        {access.suspended ? "Suspenso" : "Ativo"}
      </Badge>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={access.suspended ? "Reativar" : "Suspender"} onClick={onToggleSuspend}>
        {access.suspended ? <PlayCircle className="w-3.5 h-3.5 text-green-600" /> : <PauseCircle className="w-3.5 h-3.5 text-yellow-600" />}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso à campanha "{campaign?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>O usuário perderá todas as permissões nesta campanha.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Need useQuery import for CampaignAccessRow
import { useQuery } from "@tanstack/react-query";
import type { PermissionCategory } from "@/hooks/usePermissionCategories";
