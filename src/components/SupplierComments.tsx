import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  supplierId: string;
  agencyId: string;
}

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
};

export default function SupplierComments({ supplierId, agencyId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["supplier_comments", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_comments")
        .select("id, user_id, content, created_at")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map(c => c.user_id))];
      let names: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        names = Object.fromEntries((profs || []).map(p => [p.user_id, p.display_name || ""]));
      }
      return (data || []).map(c => ({ ...c, author_name: names[c.user_id] })) as Comment[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("supplier_comments").insert([{
        supplier_id: supplierId,
        agency_id: agencyId,
        user_id: user.id,
        content: content.trim(),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["supplier_comments", supplierId] });
      toast.success("Comentário adicionado");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_comments", supplierId] });
      toast.success("Comentário removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + (e.message || "")),
  });

  const handleSubmit = () => {
    const v = text.trim();
    if (!v) return;
    if (v.length > 2000) {
      toast.error("Máximo de 2000 caracteres");
      return;
    }
    addMutation.mutate(v);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Comentários ({comments.length})
      </h3>

      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Adicione um comentário interno sobre este fornecedor..."
          rows={3}
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!text.trim() || addMutation.isPending}
          >
            {addMutation.isPending
              ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Enviando...</>
              : <><Send className="w-3 h-3 mr-2" /> Comentar</>}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Carregando...</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-muted-foreground italic text-center py-4">
          Nenhum comentário ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 bg-muted/30 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs font-medium text-foreground">
                  {c.author_name || "Usuário"}
                  <span className="text-muted-foreground font-normal ml-2">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {user?.id === c.user_id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover comentário?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
