import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers, type UserWithRole } from "@/hooks/useAdminUsers";
import { useUserClientAccess } from "@/hooks/useMultiClientData";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useUserCampaignAccess } from "@/hooks/useUserCampaignAccess";
import { useAllUsersApproval, useUpdateApprovalStatus, type ApprovalStatus } from "@/hooks/useUserApproval";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  Users, Mail, Tag, MessageSquare, Bell, CheckSquare, 
  Palette, Image as ImageIcon, Database, Home, 
  UserCheck, Search, ChevronRight, Menu, X, Plus, Clock, UserX, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import UserPermissionCard from "@/components/admin/UserPermissionCard";
import { InvitesPanel } from "@/components/admin/InvitesPanel";
import { MessagesPanel } from "@/components/admin/MessagesPanel";
import NotificationSettingsManager from "@/components/admin/NotificationSettingsManager";
import AppearancePanel from "@/components/admin/AppearancePanel";
import RegeneratePieceImagesPanel from "@/components/admin/RegeneratePieceImagesPanel";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import CategoryManager from "@/components/admin/CategoryManager";
import { ADMIN_MENU_ITEMS } from "@/lib/adminMenuConfig";
import { AppShellV2 } from "@/components/v2/layout/AppShellV2";
import { cn, capitalizeName } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminProps {
  initialTab?: string;
}

const Admin = ({ initialTab: propInitialTab }: AdminProps) => {
  const { t } = useTranslation();
  const { isAdminOrMaster, isLoading: loadingRole } = useUserRole();
  const [searchParams] = useSearchParams();
  
  const currentTab = searchParams.get("tab") || "home";

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdminOrMaster) return <Navigate to="/" replace />;

  return (
    <AppShellV2>
      <div className="max-w-6xl mx-auto">
        <AdminContent tab={currentTab} />
      </div>
    </AppShellV2>
  );
};

const AdminContent = ({ tab }: { tab: string }) => {
  switch (tab) {
    case "home":         return <AdminHome />;
    case "users":        return <AdminUsers />;
    case "invites":      return <InvitesPanel />;
    case "categories":   return <CategoryManager />;
    case "messages":     return <MessagesPanel />;
    case "notificacoes": return <NotificationSettingsManager />;
    case "approvals":    return <AdminApprovals />;
    case "appearance":   return <AppearancePanel />;
    case "images":       return <RegeneratePieceImagesPanel />;
    case "backup":       return <BackupRestorePanel />;
    default:             return <AdminHome />;
  }
};

const AdminHome = () => {
  const [_, setSearchParams] = useSearchParams();
  const { isAdmin } = useUserRole();
  const { data: users = [] } = useAdminUsers();
  const { data: approvals = [] } = useAllUsersApproval();
  
  const pendingApprovals = approvals.filter(u => u.approval_status === "pending").length;

  const stats = [
    { label: "Usuários Ativos", value: users.length, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Aprovações Pendentes", value: pendingApprovals, icon: UserCheck, color: "text-amber-600", bg: "bg-amber-100", tab: "approvals" },
    { label: "Novas Mensagens", value: "80%", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-100", tab: "messages" },
  ];

  const quickActions = ADMIN_MENU_ITEMS.filter(item => 
    (item.access === "all" || isAdmin) && item.key !== "home"
  ).slice(0, 6);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Painel Administrativo</h2>
        <p className="text-muted-foreground mt-1">Gerencie usuários, permissões e configurações globais do sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="p-6 bg-card border rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors"
            onClick={() => stat.tab && setSearchParams({ tab: stat.tab })}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-lg", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Acesso Rápido</h3>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {quickActions.map((item) => (
            <button
              key={item.key}
              onClick={() => setSearchParams({ tab: item.key })}
              className="p-4 bg-card border rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-muted transition-colors text-center"
            >
              <div className="p-2 bg-primary/10 rounded-full">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminUsers = () => {
  const { t } = useTranslation();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const { data: allAccess = [] } = useUserClientAccess();
  const { data: allAgencyAccess = [] } = useUserAgencyAccess();
  const { data: allCampaignAccess = [] } = useUserCampaignAccess();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = searchQuery.trim()
    ? users.filter(u =>
        (u.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-xl font-bold">Gerenciamento de Usuários</h2>
          <p className="text-sm text-muted-foreground">Visualize e edite permissões de todos os usuários do sistema.</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário por nome ou ID..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loadingUsers ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map(u => (
            <UserPermissionCard
              key={u.user_id}
              userInfo={u}
              allClientAccess={allAccess}
              allAgencyAccess={allAgencyAccess}
              allCampaignAccess={allCampaignAccess}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AdminApprovals = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { data: users = [], isLoading } = useAllUsersApproval();
  const updateStatus = useUpdateApprovalStatus();
  const qc = useQueryClient();

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_users_approval"] });
      qc.invalidateQueries({ queryKey: ["pending_users_count"] });
      toast.success("Usuário excluído com sucesso.");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pending = users.filter((u) => u.approval_status === "pending");
  const approved = users.filter((u) => u.approval_status === "approved");
  const rejected = users.filter((u) => u.approval_status === "rejected");
  const sorted = [...pending, ...approved, ...rejected];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Aprovação de Novos Usuários</h2>
        <p className="text-sm text-muted-foreground">Gerencie as solicitações de acesso ao sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Pendentes</span>
          </div>
          <p className="text-2xl font-bold">{pending.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Aprovados</span>
          </div>
          <p className="text-2xl font-bold">{approved.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700">
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Rejeitados</span>
          </div>
          <p className="text-2xl font-bold">{rejected.length}</p>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((u) => {
              const isCurrentUser = u.user_id === user?.id;
              return (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <p className="font-medium">{capitalizeName(u.display_name) || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      u.approval_status === "approved" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                      u.approval_status === "pending" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                      u.approval_status === "rejected" && "bg-red-500/10 text-red-700 border-red-500/30",
                    )}>
                      {u.approval_status === "approved" ? "Aprovado" : u.approval_status === "pending" ? "Pendente" : "Rejeitado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isCurrentUser && (
                        <>
                          <Select
                            value={u.approval_status}
                            onValueChange={(val) =>
                              updateStatus.mutate({ userId: u.user_id, status: val as ApprovalStatus })
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="approved">Aprovar</SelectItem>
                              <SelectItem value="rejected">Rejeitar</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                            </SelectContent>
                          </Select>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação é permanente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteUser.mutate(u.user_id)} className="bg-destructive">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Admin;
