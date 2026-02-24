import { useNavigate } from "react-router-dom";
import { useAllUsersApproval, useUpdateApprovalStatus, type ApprovalStatus } from "@/hooks/useUserApproval";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, UserCheck, UserX, Clock } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

const UserApprovals = () => {
  const { isAdmin, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading } = useAllUsersApproval();
  const updateStatus = useUpdateApprovalStatus();
  const navigate = useNavigate();

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const pending = users.filter((u) => u.approval_status === "pending");
  const approved = users.filter((u) => u.approval_status === "approved");
  const rejected = users.filter((u) => u.approval_status === "rejected");
  const sorted = [...pending, ...approved, ...rejected];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Aprovação de Usuários</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6">
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
                        <p className="font-medium text-foreground text-sm">{u.display_name || "Sem nome"}</p>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default UserApprovals;
