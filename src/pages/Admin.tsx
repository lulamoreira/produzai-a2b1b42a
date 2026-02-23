import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers, useUpdateUserRole } from "@/hooks/useAdminUsers";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/hooks/useUserRole";

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const navigate = useNavigate();

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    if (userId === user?.id) {
      return; // prevent self-demotion
    }
    updateRole.mutate({ userId, newRole });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Painel de Administração</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            Usuários ({users.length})
          </h2>
        </div>

        {loadingUsers ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {u.display_name || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                        className="text-[10px] uppercase"
                      >
                        {u.role === "admin" ? "Admin" : "Visualizador"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.user_id === user?.id ? (
                        <span className="text-xs text-muted-foreground italic">Você</span>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
