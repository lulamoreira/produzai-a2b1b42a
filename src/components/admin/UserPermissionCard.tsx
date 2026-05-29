import { useState, useEffect } from "react";
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
  Eye, LogIn, Lock, RefreshCw, Copy, Share2, UserX,
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
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: userInfo.user_id, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Senha redefinida com sucesso!");
      setResettingPassword(false);
      setNewPassword("");
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const generatePassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const nums = "23456789";
    const syms = "!@#$%&*?";
    const all = upper + lower + nums + syms;
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    let pwd = pick(upper) + pick(lower) + pick(nums) + pick(syms);
    for (let i = 0; i < 8; i++) pwd += pick(all);
    pwd = pwd.split("").sort(() => Math.random() - 0.5).join("");
    setNewPassword(pwd);
    toast.success("Senha gerada!");
  };

  const copyPassword = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Senha copiada!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const sharePassword = async () => {
    if (!newPassword) return;
    const text = `Sua nova senha de acesso: ${newPassword}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Nova senha", text });
      } catch {/* cancelado */}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada para compartilhar!");
    }
  };

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: userInfo.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário excluído. Histórico de ações preservado.");
      setDeletingUser(false);
      setDeleteConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["all_users_approval"] });
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const roleBadge = () => {
    if (userInfo.role === "admin") return <Badge variant="default" className="text-[10px] uppercase tracking-wider">Admin</Badge>;
    if (userInfo.role === "master") return <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-orange-500/15 text-orange-700 border-orange-500/30">Master</Badge>;
    return <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Usuário</Badge>;
  };

  const totalAccesses = userAccesses.length + userAgencyAccesses.length + userCampaignAccesses.length;


  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
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
            <div className="flex items-center gap-2 group">
              <div className="relative">
                <p className="font-semibold text-foreground text-sm truncate">{capitalizeName(userInfo.display_name) || "Sem nome"}</p>
                {userInfo.last_seen_at && (new Date().getTime() - new Date(userInfo.last_seen_at).getTime()) < 5 * 60 * 1000 && (
                  <span className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online agora" />
                )}
              </div>
              <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground font-mono" title="Quantidade de acessos">
                <LogIn className="w-2.5 h-2.5" />
                {userInfo.login_count || 0}
              </div>
              {canEditName && (
                <button className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); setEditingName(true); setNameValue(userInfo.display_name || ""); }}>
                  <Edit3 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          )}
          {userInfo.company ? (
            <p className="text-xs font-semibold text-primary truncate flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 shrink-0" />
              {userInfo.company}
            </p>
          ) : (
            <p className="text-xs italic text-amber-700 truncate mt-0.5">Empresa não informada</p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-muted-foreground">{userInfo.user_id.slice(0, 8)}…</p>
            <span className="text-[10px] text-muted-foreground/40">•</span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title={`Entrou em: ${new Date(userInfo.created_at).toLocaleDateString("pt-BR")} às ${new Date(userInfo.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`}>
              <Calendar className="w-3 h-3" />
              {new Date(userInfo.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
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
                  type="button"
                  disabled={impersonatingUserId === userInfo.user_id}
                  title="Impersonar: entra imediatamente na conta deste usuário nesta aba."
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleImpersonate();
                  }}
                  className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-wait dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 transition-colors text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{impersonatingUserId === userInfo.user_id ? "Entrando..." : "Impersonar"}</span>
                </button>
              )}
              {isAdmin && (
                <AlertDialog open={resettingPassword} onOpenChange={setResettingPassword}>
                  <AlertDialogTrigger asChild>
                    <button
                      title="Redefinir Senha"
                      className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors text-xs font-medium"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Senha</span>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Redefinir senha para {userInfo.display_name}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Defina uma nova senha temporária para o usuário. Ele poderá entrar imediatamente com esta nova senha.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2">
                      <Input
                        type="text"
                        placeholder="Nova senha (mín. 6 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="font-mono"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={generatePassword}>
                          <RefreshCw className="w-3.5 h-3.5" /> Gerar senha
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyPassword} disabled={!newPassword}>
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={sharePassword} disabled={!newPassword}>
                          <Share2 className="w-3.5 h-3.5" /> Compartilhar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Gera uma senha forte de 12 caracteres com maiúsculas, minúsculas, números e símbolos.
                      </p>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => { setResettingPassword(false); setNewPassword(""); }}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={(e) => {
                          e.preventDefault();
                          handleResetPassword();
                        }} 
                        className="bg-primary"
                        disabled={!newPassword || newPassword.length < 6}
                      >
                        Salvar Nova Senha
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isAdmin && (
                <AlertDialog open={deletingUser} onOpenChange={(v) => { if (!isDeleting) { setDeletingUser(v); if (!v) setDeleteConfirmText(""); } }}>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      title="Excluir usuário"
                      className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 transition-colors text-xs font-medium"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">Excluir usuário {capitalizeName(userInfo.display_name) || ""}?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <span className="block">
                          Esta ação é <strong>permanente</strong>. O usuário perderá acesso ao sistema imediatamente e não poderá mais entrar.
                        </span>
                        <span className="block text-foreground">
                          ✓ Todo o histórico de ações, registros, comentários e dados criados por este usuário <strong>serão preservados</strong> no sistema.
                        </span>
                        <span className="block">
                          Para confirmar, digite <strong className="text-foreground">EXCLUIR</strong> abaixo:
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="EXCLUIR"
                      autoComplete="off"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
                        disabled={deleteConfirmText !== "EXCLUIR" || isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Excluindo..." : "Excluir definitivamente"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Profile Details */}
          <UserProfileDetails userId={userInfo.user_id} agencies={agencies} clients={clients} isAdmin={isAdmin} />

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
                        categories={categories}
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
                        categories={categories}
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
function UserProfileDetails({ userId, agencies, clients, isAdmin }: {
  userId: string;
  agencies: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string; agency_id: string }>;
  isAdmin: boolean;
}) {
  const { data: profile, isLoading, isError } = useQuery({
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
    retry: 1,
  });

  const { data: email } = useQuery({
    queryKey: ["user_email", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_email", { _user_id: userId });
      return (data as string) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "",
    nickname: "",
    phone: "",
    phone_is_whatsapp: false,
    job_title: "",
    company: "",
    approval_status: "pending" as "approved" | "pending" | "rejected",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        nickname: profile.nickname || "",
        phone: profile.phone || "",
        phone_is_whatsapp: profile.phone_is_whatsapp || false,
        job_title: profile.job_title || "",
        company: profile.company || "",
        approval_status: (profile.approval_status as any) || "pending",
      });
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="px-5 py-3 bg-muted/10 border-b border-border">
        <p className="text-xs text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-5 py-3 bg-muted/10 border-b border-border">
        <p className="text-xs text-destructive">Erro ao carregar dados do perfil. Tente fechar e abrir novamente.</p>
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


  const handleUpdate = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: formData.display_name,
        nickname: formData.nickname,
        phone: formData.phone,
        phone_is_whatsapp: formData.phone_is_whatsapp,
        job_title: formData.job_title,
        company: formData.company,
        approval_status: formData.approval_status,
      })
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao atualizar perfil: " + error.message);
    } else {
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["user_profile_details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
    }
  };

  const handleDeleteUser = async () => {
    try {
      // In a real app, you might want a specialized edge function to handle 
      // full user deletion (auth.users + cleanup). 
      // For now we delete from profiles which is what the user probably means by "apagar"
      // Or if they mean deleting the Auth user, we would need a service role function.
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      
      toast.success("Usuário excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
    } catch (e: any) {
      toast.error("Erro ao excluir usuário: " + e.message);
    }
  };

  const Field = ({ icon, label, value, field, type = "text" }: { 
    icon: React.ReactNode; 
    label: string; 
    value: React.ReactNode;
    field?: keyof typeof formData;
    type?: string;
  }) => (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        {isEditing && field ? (
          field === "phone_is_whatsapp" ? (
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="checkbox" 
                checked={formData[field] as boolean} 
                onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.checked }))}
                className="w-3.5 h-3.5"
              />
              <span className="text-[10px] text-muted-foreground">WhatsApp?</span>
            </div>
          ) : (
            <Input 
              className="h-7 text-xs mt-1" 
              value={formData[field] as string} 
              onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
            />
          )
        ) : (
          <p className="text-xs text-foreground truncate">{value || <span className="text-muted-foreground italic">—</span>}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 bg-muted/10 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <IdCard className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Dados do usuário</h4>
        
        {isEditing ? (
          <Select value={formData.approval_status} onValueChange={v => setFormData(prev => ({ ...prev, approval_status: v as any }))}>
            <SelectTrigger className="h-7 text-[10px] w-24 ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-[10px] ml-auto">
            {profile.approval_status === "approved" ? "Aprovado" : profile.approval_status === "pending" ? "Pendente" : profile.approval_status || "—"}
          </Badge>
        )}

        {isAdmin && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button size="sm" className="h-7 px-2 text-[10px]" onClick={handleUpdate}>Salvar</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setIsEditing(true)}>
                  <Edit3 className="w-3 h-3 mr-1" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação excluirá permanentemente o usuário e todos os seus dados. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Nome" value={profile.display_name} field="display_name" />
        <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Apelido" value={profile.nickname} field="nickname" />
        <Field icon={<Mail className="w-3.5 h-3.5" />} label="E-mail" value={email} />
        <Field
          icon={<Phone className="w-3.5 h-3.5" />}
          label="Telefone"
          field="phone"
          value={
            profile.phone ? (
              <span className="inline-flex items-center gap-1">
                {profile.phone}
                {profile.phone_is_whatsapp && <MessageCircle className="w-3 h-3 text-green-600" />}
              </span>
            ) : null
          }
        />
        {isEditing && <Field icon={<MessageCircle className="w-3.5 h-3.5" />} label="WhatsApp?" value={null} field="phone_is_whatsapp" />}
        <Field icon={<Briefcase className="w-3.5 h-3.5" />} label="Cargo" value={profile.job_title} field="job_title" />
        <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Empresa" value={profile.company} field="company" />
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

