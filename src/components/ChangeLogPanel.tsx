import { useChangeLogs, type Piece } from "@/hooks/useStoreData";
import { Clock, Plus, Minus, ArrowUpDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChangeLogPanelProps {
  storeId: number;
  pieces: Piece[];
}

const actionConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  add_quantity: { icon: <Plus className="w-3 h-3" />, label: "Aumento", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" },
  remove_quantity: { icon: <Minus className="w-3 h-3" />, label: "Redução", color: "bg-orange-500/15 text-orange-700 border-orange-500/20" },
  add_piece: { icon: <Plus className="w-3 h-3" />, label: "Peça Adicionada", color: "bg-blue-500/15 text-blue-700 border-blue-500/20" },
  remove_piece: { icon: <Trash2 className="w-3 h-3" />, label: "Peça Removida", color: "bg-red-500/15 text-red-700 border-red-500/20" },
  update_quantity: { icon: <ArrowUpDown className="w-3 h-3" />, label: "Alteração", color: "bg-purple-500/15 text-purple-700 border-purple-500/20" },
};

const ChangeLogPanel = ({ storeId, pieces }: ChangeLogPanelProps) => {
  const { data: logs = [], isLoading } = useChangeLogs(storeId);

  const getPieceName = (pieceId: number | null) => {
    if (!pieceId) return "Item desconhecido";
    const piece = pieces.find((p) => p.id === pieceId);
    return piece ? piece.name : `Peça #${pieceId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma alteração registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
      {logs.map((log) => {
        const cfg = actionConfig[log.action] || actionConfig.update_quantity;
        return (
          <div
            key={log.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-full border ${cfg.color}`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground mt-1 truncate">
                {getPieceName(log.piece_id)}
              </p>
              {(log.old_value !== null || log.new_value !== null) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.old_value ?? 0} → {log.new_value ?? 0}
                </p>
              )}
              {log.description && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">{log.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChangeLogPanel;
