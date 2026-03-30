import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface ScheduleHistorySheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  storeId: string;
  storeName: string;
}

export default function ScheduleHistorySheet({ open, onOpenChange, campaignId, storeId, storeName }: ScheduleHistorySheetProps) {
  const queryClient = useQueryClient();
  const { isAdmin, isMaster } = useUserRole();
  const canManage = isAdmin || isMaster;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["schedule-history", campaignId, storeId],
    enabled: open && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_history")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch profile names for each unique user_id
      const userIds = [...new Set((data || []).map((d: any) => d.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.nickname || p.display_name || "Sistema";
          }
        }
      }
      return (data || []).map((d: any) => ({ ...d, authorName: profileMap[d.user_id] || "Sistema" }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-history", campaignId, storeId] });
      toast.success("Registro removido");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-sm">Histórico — {storeName}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-3 mt-4">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro no histórico.</p>
          )}
          {entries.map((entry) => {
            const authorName = entry.profiles?.nickname || entry.profiles?.display_name || "Sistema";
            return (
              <div key={entry.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-foreground whitespace-pre-wrap">{entry.content}</p>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(entry.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {authorName} · {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
