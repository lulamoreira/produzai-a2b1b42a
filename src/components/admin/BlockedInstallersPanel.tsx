import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBlockedInstallers } from "@/hooks/useBlockedInstallers";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  UserX, Search, ShieldAlert, Trash2, Clock, ShieldCheck, 
  AlertCircle, ShieldX 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function BlockedInstallersPanel({ clientId }: { clientId?: string }) {
  const { t } = useTranslation();
  const { data: blockedData, isLoading } = useBlockedInstallers(clientId);
  const { isAdminOrMaster } = useUserRole();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const unblockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blocked_installers" as any)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked_installers"] });
      toast.success("Instalador desbloqueado com sucesso.");
      setUnblockingId(null);
    },
    onError: (error: any) => {
      console.error("Error unblocking installer:", error);
      toast.error("Erro ao desbloquear instalador.");
    }
  });

  const filtered = useMemo(() => {
    if (!blockedData?.raw) return [];
    return blockedData.raw.filter(item => {
      const search = searchQuery.toLowerCase().trim();
      if (!search) return true;
      return (
        (item.name || "").toLowerCase().includes(search) ||
        item.doc_norm.includes(search) ||
        (item.reason || "").toLowerCase().includes(search)
      );
    });
  }, [blockedData, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="border rounded-xl">
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserX className="w-6 h-6 text-red-500" />
          Instaladores Bloqueados
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lista de profissionais impedidos de atuar nas campanhas por CPF ou RG.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, documento ou motivo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Nome</TableHead>
              <TableHead className="font-bold">Documento</TableHead>
              <TableHead className="font-bold">Motivo</TableHead>
              <TableHead className="font-bold">Escopo</TableHead>
              {isAdminOrMaster && <TableHead className="font-bold text-right w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdminOrMaster ? 5 : 4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-muted/30" />
                    <p>Nenhum instalador bloqueado encontrado.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-semibold text-stone-900">
                      {item.name || "Sem nome informado"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-1 py-0 h-4">
                        {item.doc_type}
                      </Badge>
                      <span className="font-mono text-sm text-stone-600">
                        {item.doc_norm}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-stone-600 italic">
                      {item.reason || "Motivo não especificado"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {(item as any).client_id ? "Cliente" : "Global"}
                    </Badge>
                  </TableCell>
                  {isAdminOrMaster && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-stone-400 hover:text-emerald-600 transition-colors h-8 w-8"
                        onClick={() => setUnblockingId(item.id)}
                        title="Desbloquear instalador"
                      >
                        <ShieldX className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!unblockingId} onOpenChange={(open) => !open && setUnblockingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-500" />
              Desbloquear Instalador?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o bloqueio deste profissional? Ele poderá ser adicionado a novas equipes normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unblockMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => unblockingId && unblockMutation.mutate(unblockingId)}
              disabled={unblockMutation.isPending}
            >
              {unblockMutation.isPending ? "Processando..." : "Confirmar Desbloqueio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
