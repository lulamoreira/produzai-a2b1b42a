import { useActivityLogs } from "@/hooks/useActivityLogs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList } from "lucide-react";

interface ActivityLogPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  storeId: string;
  storeName: string;
  module: string;
}

export default function ActivityLogPanel({ open, onOpenChange, campaignId, storeId, storeName, module }: ActivityLogPanelProps) {
  const { data: logs = [], isLoading } = useActivityLogs(campaignId, storeId, module);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Log de Atividades — {storeName}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-2 mt-4">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
          {!isLoading && logs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
              <p className="text-xs font-medium text-foreground">{log.action}</p>
              {log.details && (
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{log.details}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {log.author_name} · {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
