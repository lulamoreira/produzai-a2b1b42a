import { useNavigate } from "react-router-dom";
import { capitalizeName } from "@/lib/utils";
import { useAllUsersApproval, useUpdateApprovalStatus, type ApprovalStatus } from "@/hooks/useUserApproval";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Clock, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

const statusConfig: Record<ApprovalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  approved: {
    label: "Aprovado",
    color: "bg-green-500/15 text-green-700 border-green-500/30",
    icon: <UserCheck className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: "Rejeitado",
    color: "bg-red-500/15 text-red-700 border-red-500/30",
    icon: <UserX className="w-3.5 h-3.5" />,
  },
  pending: {
    label: "Pendente",
    color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function useCurrentUserAccessScope() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: agencyAccess } = useQuery({
    queryKey: ["my_agency_access", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_agency_access")
        .select("agency_id")
        .eq("user_id", user!.id)
        .eq("suspended", false);
      if (error) throw error;
      return data.map((r) => r.agency_id);
    },
    enabled: !!user && !isAdmin,
  });

  const { data: clientAccess } = useQuery({
    queryKey: ["my_client_access", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select("client_id")
        .eq("user_id", user!.id)
        .eq("suspended", false);
      if (error) throw error;
      return data.map((r) => r.client_id);
    },
    enabled: !!user && !isAdmin,
  });

  return { agencyIds: agencyAccess ?? [], clientIds: clientAccess ?? [] };
}

const UserApprovals = () => {
  const { user } = useAuth();
  const { isAdmin, isAdminOrMaster, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading } = useAllUsersApproval();
  const updateStatus = useUpdateApprovalStatus();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { agencyIds, clientIds } = useCurrentUserAccessScope();

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
      toast.success("Usuário excluído!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filteredUsers = useMemo(() => {
    if (isAdmin) return users;
    return users.filter((u) => {
      if (u.agency_id && agencyIds.includes(u.agency_id)) return true;
      if (u.client_id && clientIds.includes(u.client_id)) return true;
      return false;
    });
  }, [users, isAdmin, agencyIds, clientIds]);

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdminOrMaster) return <Navigate to="/" replace />;

  const pending = filteredUsers.filter((u) => u.approval_status === "pending");
  const approved = filteredUsers.filter((u) => u.approval_status === "approved");
  const rejected = filteredUsers.filter((u) => u.approval_status === "rejected");
  const sorted = [...pending, ...approved, ...rejected];

  return (
    <AppLayout breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Aprovações" }]}>
      <div className="max-w-5xl mx-auto">
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">{pending.length} pendente(s)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <UserCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{approved.length} aprovado(s)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <UserX className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">{rejected.length} rejeitado(s)</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Nenhum usuário encontrado.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
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
                  const cfg = statusConfig[u.approval_status];
                  const isCurrentUser = u.user_id === user?.id;
                  return (
                    <TableRow
                      key={u.user_id}
                      className={
                        u.approval_status === "pending"
                          ? "bg-yellow-500/5"
                          : u.approval_status === "rejected"
                          ? "bg-red-500/5"
                          : "bg-green-500/5"
                      }
                    >
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">{capitalizeName(u.display_name) || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isCurrentUser ? (
                            <span className="text-xs text-muted-foreground italic">Você</span>
                          ) : (
                            <>
                              <Select
                                value={u.approval_status}
                                onValueChange={(val) =>
                                  updateStatus.mutate({ userId: u.user_id, status: val as ApprovalStatus })
                                }
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="approved">✅ Aprovar</SelectItem>
                                  <SelectItem value="rejected">❌ Rejeitar</SelectItem>
                                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                                </SelectContent>
                              </Select>
                              {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir usuário "{u.display_name || "Sem nome"}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação é permanente. O usuário e todos os seus acessos serão removidos do sistema.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser.mutate(u.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      SIM, excluir
                                    </AlertDialogAction>
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
        )}
      </div>
    </AppLayout>
  );
};

export default UserApprovals;
