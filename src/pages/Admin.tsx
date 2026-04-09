import { useState } from "react";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useUserClientAccess } from "@/hooks/useMultiClientData";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useUserCampaignAccess } from "@/hooks/useUserCampaignAccess";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Users, Tags, Database, UserCheck, Search, MessageSquareText } from "lucide-react";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserPermissionCard from "@/components/admin/UserPermissionCard";
import CategoryManager from "@/components/admin/CategoryManager";
import SystemMessagesManager from "@/components/admin/SystemMessagesManager";

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, isAdminOrMaster, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const { data: allAccess = [] } = useUserClientAccess();
  const { data: allAgencyAccess = [] } = useUserAgencyAccess();
  const { data: allCampaignAccess = [] } = useUserCampaignAccess();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "users";
  const [searchQuery, setSearchQuery] = useState("");

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdminOrMaster) return <Navigate to="/" replace />;

  // Sort: admin first, then master, then viewers. Current user at top.
  const sortedUsers = [...users].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    const roleOrder = { admin: 0, master: 1, viewer: 2 };
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  const filteredUsers = searchQuery.trim()
    ? sortedUsers.filter(u =>
        (u.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedUsers;

  return (
    <AppLayout
      breadcrumbs={[{ label: "Admin" }]}
      headerRight={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/approvals")}>
          <UserCheck className="w-4 h-4" /> Aprovações
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue={initialTab}>
          <TabsList className="mb-6 bg-card border border-border">
            <TabsTrigger value="users" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="w-4 h-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Tags className="w-4 h-4" /> Categorias
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquareText className="w-4 h-4" /> Mensagens
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="backup" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Database className="w-4 h-4" /> Backup
              </TabsTrigger>
            )}
          </TabsList>

          {/* ─── Users Tab ─── */}
          <TabsContent value="users">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-base font-semibold text-foreground">
                Usuários ({users.length})
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <CreateUserDialog />
                <div className="relative max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Clique em um usuário para ver e editar todas as permissões. Admin/Master têm acesso automático a tudo.
            </p>

            {loadingUsers ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">
                {searchQuery ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}
              </p>
            ) : (
              <div className="space-y-3">
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
          </TabsContent>

          {/* ─── Categories Tab ─── */}
          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>

          {/* ─── Messages Tab ─── */}
          <TabsContent value="messages">
            <SystemMessagesManager />
          </TabsContent>

          {/* ─── Backup Tab ─── */}
          {isAdmin && (
            <TabsContent value="backup">
              <BackupRestorePanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
