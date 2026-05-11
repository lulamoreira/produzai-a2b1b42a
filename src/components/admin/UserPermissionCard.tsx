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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronRight, Edit3, Plus, Trash2,
  PauseCircle, PlayCircle, Building2, KeyRound, Shield, Megaphone,
  User as UserIcon, Mail, Phone, Briefcase, Calendar, Languages, Palette, MessageCircle, IdCard,
  Eye, LogIn,
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
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

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
    const existing = userCampaignAccesses.find(a => a.campaign_id === newCampaignId && a.category_id === newCampaignCategoryId);
    if (existing) { toast.error("Já possui este acesso com a mesma categoria."); return; }
    addCampaignAccess.mutate({ user_id: userInfo.user_id, campaign_id: newCampaignId, category_id: newCampaignCategoryId });
    setAddingCampaign(false); setNewCampaignClientId(""); setNewCampaignId(""); setNewCampaignCategoryId("");
  };

  const handleImpersonate = async () => {
    setImpersonatingUserId(userInfo.user_id);
    const { data, error } = await supabase.functions.invoke("impersonate-user", {
      body: { userId: userInfo.user_id, redirectTo: window.location.origin + "/" },
    });

    if (error || (!data?.tokenHash && !data?.emailOtp)) {
      setImpersonatingUserId(null);
      toast.error("Erro ao impersonar: " + (error?.message || data?.error || "credenciais não geradas"));
      return;
    }

    const verifyResult = data.tokenHash
      ? await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.tokenHash })
      : await supabase.auth.verifyOtp({ type: "magiclink", email: data.email, token: data.emailOtp });

    if (verifyResult.error) {
      setImpersonatingUserId(null);
      toast.error("Erro ao entrar na conta: " + verifyResult.error.message);
      return;
    }

    sessionStorage.removeItem("preview_user_id");
    sessionStorage.removeItem("preview_user_name");
    toast.success(`Entrando como ${capitalizeName(userInfo.display_name) || "usuário"}...`);
    window.location.assign("/");
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
    <div className={`flex flex-col gap-2 p-2.5 rounded-lg border ${suspended ? "opacity-50 bg-muted/30 border-border" : "bg-muted/10 border-border"}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{label}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={categoryId || ""} onValueChange={onChangeCategory}>
          <SelectTrigger className="h-9 text-xs flex-1 min-w-[120px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 justify-end">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
            {suspended ? "Suspenso" : "Ativo"}
          </Badge>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title={suspended ? "Reativar" : "Suspender"} onClick={onToggleSuspend}>
            {suspended ? <PlayCircle className="w-4 h-4 text-green-600" /> : <PauseCircle className="w-4 h-4 text-yellow-600" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
      </div>
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
          {!isCurrentUser && (
            <>
              <button
                title="Pré-visualizar: ver o sistema com o menu/permissões deste usuário, sem sair da sua conta. Para voltar, clique em 'Sair' no banner amarelo no topo."
                onClick={(e) => {
                  e.stopPropagation();
                  sessionStorage.setItem("preview_user_id", userInfo.user_id);
                  if (userInfo.display_name) {
                    sessionStorage.setItem("preview_user_name", userInfo.display_name);
                  }
                  window.location.href = "/";
                }}
                className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 transition-colors text-xs font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver como</span>
              </button>
              {isAdmin && (
                <button
                  title="Impersonar: gera um link mágico de login deste usuário e copia para a área de transferência. Abra uma janela anônima (Ctrl+Shift+N) e cole o link para entrar de verdade como ele."
                  onClick={async (e) => {
                    e.stopPropagation();
                    const { data, error } = await supabase.functions.invoke("impersonate-user", {
                      body: { userId: userInfo.user_id, redirectTo: window.location.origin + "/" },
                    });
                    if (error || !data?.url) {
                      toast.error("Erro: " + (error?.message || data?.error || "falha ao gerar link"));
                      return;
                    }
                    try {
                      await navigator.clipboard.writeText(data.url);
                      toast.success(
                        "Link copiado! Agora abra uma janela anônima (Ctrl+Shift+N ou Cmd+Shift+N) e cole o link lá.",
                        { duration: 8000 }
                      );
                    } catch {
                      window.open(data.url, "_blank", "noopener");
                      toast.success("Link aberto em nova aba. Atenção: isso pode deslogar sua sessão atual.");
                    }
                  }}
                  className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 transition-colors text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Impersonar</span>
                </button>
              )}
            </>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Profile Details */}
          <UserProfileDetails userId={userInfo.user_id} agencies={agencies} clients={clients} />

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
                  <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newAgencyId} onValueChange={setNewAgencyId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Agência" /></SelectTrigger>
                      <SelectContent>
                        {agencies.filter(a => !userAgencyAccesses.some(ua => ua.agency_id === a.id)).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newAgencyCategoryId} onValueChange={setNewAgencyCategoryId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 text-xs flex-1" onClick={handleAddAgencyAccess} disabled={!newAgencyId || !newAgencyCategoryId}>Adicionar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingAgency(false)}>Cancelar</Button>
                    </div>
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
                  <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newClientId} onValueChange={setNewClientId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.filter(c => !userAccesses.some(a => a.client_id === c.id)).map(c => (
                          <SelectItem key={c.id} value={c.id}>{getClientLabel(c.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newClientCategoryId} onValueChange={setNewClientCategoryId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 text-xs flex-1" onClick={handleAddClientAccess} disabled={!newClientId || !newClientCategoryId}>Adicionar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingClient(false)}>Cancelar</Button>
                    </div>
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
                  <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Select value={newCampaignClientId} onValueChange={val => { setNewCampaignClientId(val); setNewCampaignId(""); }}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{getClientLabel(c.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={newCampaignId} onValueChange={setNewCampaignId} disabled={!newCampaignClientId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Campanha" /></SelectTrigger>
                      <SelectContent>
                        {campaignsForClient.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newCampaignCategoryId} onValueChange={setNewCampaignCategoryId}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 text-xs flex-1" onClick={handleAddCampaignAccess} disabled={!newCampaignId || !newCampaignCategoryId}>Adicionar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCampaign(false); setNewCampaignClientId(""); }}>Cancelar</Button>
                    </div>
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
    <div className={`flex flex-col gap-2 p-2.5 rounded-lg border ${access.suspended ? "opacity-50 bg-muted/30 border-border" : "bg-muted/10 border-border"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Megaphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{label}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={access.category_id || ""} onValueChange={onChangeCategory}>
          <SelectTrigger className="h-9 text-xs flex-1 min-w-[120px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 justify-end">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${access.suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
            {access.suspended ? "Suspenso" : "Ativo"}
          </Badge>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title={access.suspended ? "Reativar" : "Suspender"} onClick={onToggleSuspend}>
            {access.suspended ? <PlayCircle className="w-4 h-4 text-green-600" /> : <PauseCircle className="w-4 h-4 text-yellow-600" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
      </div>
    </div>
  );
}

// Sub-component to fetch and display user's full profile data
function UserProfileDetails({ userId, agencies, clients }: {
  userId: string;
  agencies: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string; agency_id: string }>;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["user_profile_details", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, nickname, phone, phone_is_whatsapp, job_title, company, preferred_language, theme_hue, created_at, updated_at, approval_status, name_confirmed, avatar_url, agency_id, client_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: email } = useQuery({
    queryKey: ["user_email", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_email" as any, { _user_id: userId });
      return (data as string) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="px-5 py-3 bg-muted/10 border-b border-border">
        <p className="text-xs text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-5 py-3 bg-muted/10 border-b border-border">
        <p className="text-xs text-muted-foreground italic">Perfil não encontrado.</p>
      </div>
    );
  }

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const langLabel: Record<string, string> = { "pt-BR": "Português (BR)", en: "English", es: "Español" };
  const agencyName = profile.agency_id ? agencies.find(a => a.id === profile.agency_id)?.name : null;
  const clientName = profile.client_id ? clients.find(c => c.id === profile.client_id)?.name : null;

  const Field = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-xs text-foreground truncate">{value || <span className="text-muted-foreground italic">—</span>}</p>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 bg-muted/10 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <IdCard className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Dados do usuário</h4>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {profile.approval_status === "approved" ? "Aprovado" : profile.approval_status === "pending" ? "Pendente" : profile.approval_status || "—"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Nome" value={profile.display_name} />
        <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Apelido" value={profile.nickname} />
        <Field icon={<Mail className="w-3.5 h-3.5" />} label="E-mail" value={email} />
        <Field
          icon={<Phone className="w-3.5 h-3.5" />}
          label="Telefone"
          value={
            profile.phone ? (
              <span className="inline-flex items-center gap-1">
                {profile.phone}
                {profile.phone_is_whatsapp && <MessageCircle className="w-3 h-3 text-green-600" />}
              </span>
            ) : null
          }
        />
        <Field icon={<Briefcase className="w-3.5 h-3.5" />} label="Cargo" value={profile.job_title} />
        <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Empresa" value={profile.company} />
        <Field icon={<Languages className="w-3.5 h-3.5" />} label="Idioma" value={profile.preferred_language ? langLabel[profile.preferred_language] || profile.preferred_language : null} />
        <Field icon={<Palette className="w-3.5 h-3.5" />} label="Tema (matiz)" value={profile.theme_hue != null ? `${profile.theme_hue}°` : null} />
        <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Agência vinculada" value={agencyName} />
        <Field icon={<KeyRound className="w-3.5 h-3.5" />} label="Cliente vinculado" value={clientName} />
        <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Cadastrado em" value={fmtDate(profile.created_at)} />
        <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Atualizado em" value={fmtDate(profile.updated_at)} />
      </div>
    </div>
  );
}

