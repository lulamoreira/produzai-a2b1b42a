import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePendingUsersCount } from "@/hooks/useUserApproval";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

export const PendingUsersAlert = () => {
  const { isAdmin } = useUserRole();
  const { data: pendingCount = 0 } = usePendingUsersCount();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin && pendingCount > 0) {
      // Small delay so it doesn't flash on quick navigations
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, pendingCount]);

  if (!isAdmin || pendingCount === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-yellow-500" />
            Usuários aguardando aprovação
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCount === 1
              ? "Há 1 novo usuário aguardando sua aprovação para acessar o sistema."
              : `Há ${pendingCount} novos usuários aguardando sua aprovação para acessar o sistema.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Ir para tela principal
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              navigate("/approvals");
            }}
            className="gap-1"
          >
            Ir para aprovações <ArrowRight className="w-4 h-4" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
